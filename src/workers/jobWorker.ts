import { pool } from "../db/connection";

//how often worker checks for new jobs in ms
const POLL_INTERVAL_MS = 500;

//how many times to retry a failed delivery
const MAX_DELIVERY_ATTEMPTS = 3;

//retry delay
const DELIVERY_RETRY_DELAY_MS = 1000;

//claim 1 job safely (prevents 2 workers taking same job)
async function claimNextJob(){
    //transaction: select + update must be atomic
    const client = await pool.connect(); // run multiple transactions on the same connection. This ensures selecting and updating a job 
                                         // happens atomically which means operations run as a single unit of work. 
                                         // either ALL queries succeed and commit, or if something fails they are rolled back.
                                        // this prevents partial updates and ensures only one worker can claim the job. 
    try{
        await client.query("BEGIN"); // start transaction and block, meaning everything after this runs as one atomic unit until commit or rollback

        //pick 1 pending job and lock it so others skip it
        const jobRes = await client.query(
            `
            SELECT j.id, j.pipeline_id, j.payload, p.action_type
            FROM jobs j
            JOIN pipelines p ON p.id = j.pipeline_id
            WHERE j.status = 'pending'  -- only jobs not processed yet 
            ORDER BY j.id ASC           -- oldest jobs first(fifo)
            FOR UPDATE SKIP LOCKED      -- locks selected job and skip jobs already locked by other workers
            LIMIT 1                     -- worker takes only one job at a time
            `
        ); 

        // edge case
        if(jobRes.rowCount === 0){
            await client.query("COMMIT"); // do nothing
            return null;
        }

        const job = jobRes.rows[0];

        //mark as processing
        await client.query(
            `
            UPDATE jobs
            SET status = 'processing'
            WHERE id = $1
            `,
            [job.id]
        );

        await client.query("COMMIT"); // release lock
        return job;
    } catch(err){
        await client.query("ROLLBACK"); // undo work
        throw err;
    }finally{
        client.release(); // return connection to pool
    }
}

// action types
// function chooses what processing logic to run based on the pipeline's action type
function runAction(actionType: string, payload: any){
    switch(actionType){
        case "extract_commits":
            //keep only commit field if exists
            return {commit: payload?.commit ?? null, repository: payload?.repository ?? null};
        
        case "uppercase_repo":
            // example: uppercase repo name
            return { repository: String(payload?.repository ?? "").toUpperCase()};
        
        case "echo":
            // example: return as is
            return { payload }

        case "lowercase_repo":
            return { repository: String(payload?.repository ?? "").toLowerCase()};
        
        case "count_payload_keys":
            return { key_count: Object.keys(payload ?? {}).length};
        
        default:
            // unknown action should fail the job
            throw new Error(`Unknown action_type: ${actionType}`);
    }
}

// function that takes in a jobId and result and updates the schema
async function completeJob(jobId: number, result: any){
    await pool.query(
        `
        UPDATE JOBS
        SET status = 'completed',
            processed_at = NOW(),
            result = $2,
            error = NULL
        WHERE id = $1
        `,
        [jobId, result]
    );
}

// function that fails a job and updates the table
async function failJob(jobId: number, err: any){
    await pool.query(
        `
        UPDATE jobs
        SET status = 'failed',
        processed_at = NOW(),
        error = $2
        WHERE id = $1
        `,
        [jobId, String(err?.message ?? err)]
    );
}

// function query that gets all subscribers for a pipeline
async function getSubscribersForPipeline(pipelineId: number){
    const result = await pool.query(
        `
        SELECT * FROM pipeline_subscribers
        WHERE pipeline_id = $1
        ORDER BY id ASC
        `,
        [pipelineId]
    );

    return result.rows;
}

// deliver processed result to one subscriber with retry logic
// each attempt is recorded in job_deliveries
async function deliverToSubscriber(jobId: number, targetUrl: string, result: any) {
  for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt++) {
    try{
      // send processed result to subscriber endpoint
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_id: jobId, // which job produced result
          result,        // processed worker output
        }),
      });

      // record this delivery attempt
      await pool.query(
        `
        INSERT INTO job_deliveries (job_id, subscriber_url, attempt, status, response_code)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [jobId, targetUrl, attempt, response.ok ? "success" : "failed", response.status]
      );

      // if subscriber returned HTTP success, stop retrying
      if (response.ok){
        console.log(`Delivered Job ${jobId} to ${targetUrl} on attempt ${attempt}`);
        return;
      }
    
    // HTTP request reached subscriber, but subscriber returned failure status
    console.error(`Delivery failed for Job ${jobId} to ${targetUrl} on attempt ${attempt} with status ${response.status}`);

    }catch(err) {
      // request itself failed before a valid HTTP response was returned
      await pool.query(
        `
        INSERT INTO job_deliveries (job_id, subscriber_url, attempt, status, response_code)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [jobId, targetUrl, attempt, "failed", null]
      );

      console.error(`Delivery crashed for Job ${jobId} to ${targetUrl} on attempt ${attempt}:`, err);
    }

    // if this was not the last attempt, wait before retrying
    if (attempt < MAX_DELIVERY_ATTEMPTS) {
      // simple backoff: 1s, 2s, 3s...
      await sleep(DELIVERY_RETRY_DELAY_MS * attempt);
    }
}

  // all attempts failed
  console.error(`All delivery attempts failed for Job ${jobId} for ${targetUrl}`);
}

//fetches all subscribers for a pipeline
//sends the processed result to each one
async function deliverJobResults(jobId: number, pipelineId: number, result: any){

    const subscribers = await getSubscribersForPipeline(pipelineId); // returns array of rows

    //edge case, if no subs exist skip delivery
    if(subscribers.length === 0){
        console.log(`No subscribers found for pipeline ${pipelineId}`);
        return;
    }

    // loop through each subscriber and deliver result one by one
    for(const subscriber of subscribers){
        await deliverToSubscriber(jobId,subscriber.target_url, result);
    }
}

//helper function that sleweps between retry attempts
function sleep(ms: number){
    return new Promise((resolve) => setTimeout(resolve,ms)); // function that creates a promise, gives resolve function
                                                             // after ms , resolve runs and promise completes
}

// main loop
async function workLoop(){
    while(true){
        const job = await claimNextJob(); // claim Pending job

        if(!job){
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
            continue;
        }

        try{
            // run action on payload 
            const result = runAction(job.action_type, job.payload);

            // if action succeeds, store result and mark job as completed
            await completeJob(job.id,result);
            
            // deliver processed result to all subscribers of this pipeline
            await deliverJobResults(job.id, job.pipeline_id, result);

            console.log(`Completed Job: ${job.id} (${job.action_type})`);
        } catch(err){
            // if action fails, mark this specific job as failed
            await failJob(job.id, err);

            console.log(`Failed Job: ${job.id} (${job.action_type})`);
        }
    }
}

workLoop().catch((err) =>{
    console.error("fatal worker error:", err);
    process.exit(1);
});