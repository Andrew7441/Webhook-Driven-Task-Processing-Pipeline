import { pool } from "../db/connection";

//how often worker checks for new jobs in ms
const POLL_INTERVAL_MS = 500;

//claim 1 job safely (prevents 2 workers taking same job)
async function claimNextJob(){
    //transaction: select + update must be atomic
    const client = await pool.connect();
    
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

// main loop
async function workLoop(){
    while(true){
        const job = await claimNextJob(); // claim Pending job

        if(!job){
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
            continue;
        }

        try{
            // run pipelines processing action on the stored webhook payload
            const result = runAction(job.action_type, job.payload);

            // if action succeeds, store result and mark job as completed
            await completeJob(job.id,result);

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