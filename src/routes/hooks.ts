import { Router } from "express";
import { pool } from "../db/connection";

export const hooksRouter = Router();  // router instance for webhook endpoints

// POST /hooks/:sourceKey -> webhook ingestion endpoint
hooksRouter.post("/:sourceKey", async (req, res) =>{
    const { sourceKey } = req.params;   // extract sourceKey from URL parameter
    const payload = req.body;           // webhook request body (event data)

    try{
        //query database to find pipeline with this source_key
        const pipelineResult = await pool.query(
            `SELECT id FROM pipelines WHERE source_key = $1`,
            [sourceKey] // parameterized query prevents SQL injection
        );

        if(pipelineResult.rowCount === 0) return res.status(404).send({error: "pipeline not found"}); // edge case

        const pipelineId = pipelineResult.rows[0].id; // extract pipeline ID from query result

        //create a new job entry in jobs table
        const jobResult = await pool.query(
            `
            INSERT INTO jobs (pipeline_id, payload, status)
            VALUES ($1, $2, 'pending')
            RETURNING id, status, created_at
            `,
            [pipelineId, payload] // store pipeline id + webhook payload in $1 & $2
        );

        return res.status(202).send({
            message: "job queued",      // confirmation message
            job: jobResult.rows[0],     // return job metadata
        });

    } catch(err){
        console.error(err);     // log server/db errors for debugging
        return res.status(500).send({ error: "internal server error"}); // generic error res
    }
});

