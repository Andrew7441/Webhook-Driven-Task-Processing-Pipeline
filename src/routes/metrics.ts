import { Router } from "express";
import { pool } from "../db/connection";


export const metricsRouter = Router();

// GET /metrics
// returns a simple system-level counts for monitoring
metricsRouter.get("/", async (req, res) => {
    try{
        //run all queries in parallel to optimize speed
        const[
            pipelineResult, 
            subscriberResult,
            totalJobsResult,
            pendingJobsResult,
            processingJobsResult,
            completedJobsResult,
            failedJobsResult,
            deliveriesResult,
            successfulDeliveriesResult,
            failedDeliveriesResult,
        ] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS count FROM pipelines`),
            pool.query(`SELECT COUNT(*)::int AS count FROM pipeline_subscribers`),
            pool.query(`SELECT COUNT(*)::int AS count FROM jobs`),
            pool.query(`SELECT COUNT(*)::int AS count FROM jobs WHERE status = 'pending'`),
            pool.query(`SELECT COUNT(*)::int AS count FROM jobs WHERE status = 'processing'`),
            pool.query(`SELECT COUNT(*)::int AS count FROM jobs WHERE status = 'completed'`),
            pool.query(`SELECT COUNT(*)::int AS count FROM jobs WHERE status = 'failed'`),
            pool.query(`SELECT COUNT(*)::int AS count FROM job_deliveries`),
            pool.query(`SELECT COUNT(*)::int AS count FROM job_deliveries WHERE status = 'success'`),
            pool.query(`SELECT COUNT(*)::int AS count FROM job_deliveries WHERE status = 'failed'`),
        ]);

        return res.send({
            pipelines: pipelineResult.rows[0].count,
            subscribers: subscriberResult.rows[0].count,
            jobs: {
                total: totalJobsResult.rows[0].count,
                pending: pendingJobsResult.rows[0].count,
                processing: processingJobsResult.rows[0].count,
                completed: completedJobsResult.rows[0].count,
                failed: failedJobsResult.rows[0].count,
            },
            deliveries: {
                total: deliveriesResult.rows[0].count,
                successful: successfulDeliveriesResult.rows[0].count,
                failed: failedDeliveriesResult.rows[0].count,
            },
        })
    }catch(err: any){
        console.log(err); // logs unexpected server or db errors
        return res.status(500).send({ error: "internal server error"});
    }
});