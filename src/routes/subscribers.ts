import { Router } from "express";
import { pool } from "../db/connection";

export const SubscriberRouter = Router(); // create router instance dedicated to subscriber endpoints

//POST /pipelines/:pipelineId/subscribers 
//adds a subscriber URL to a pipeline
SubscriberRouter.post("/:pipelineId/subscribers", async (req, res) => {
    const pipelineId = Number(req.params.pipelineId); // Express extracts :pipelineId from the URL (route parameter)
    const { target_url } = req.body ?? {};            // subscriber destination URL from request body

    // check edge cases
    if(!pipelineId || !target_url) return res.status(400).send({error: "PipelineId and targetUrl are both required!"});

    // insert subscriber record so this pipeline can deliver results to this URL
    const result = await pool.query(
        `
        INSERT INTO pipeline_subscribers (pipeline_id, target_url)
        VALUES ($1, $2)
        RETURNING id, pipeline_id, target_url, created_at
        `,
        [pipelineId, target_url]
    );

    return res.status(201).send(result.rows[0]); // return the created subscriber
});

// GET /pipelines/:pipelineId/subscribers
// returns all subscriber URLs registered
SubscriberRouter.get("/:pipelineId/subscribers", async (req, res) => {
    const pipelineId = Number(req.params.pipelineId);

    if(!pipelineId) return res.status(400).send({error: "pipelineId is required"});

    const result = await pool.query(
        `
        SELECT * FROM pipeline_subscribers 
        WHERE pipeline_id = $1
        ORDER BY id ASC
        `,
        [pipelineId]
    );

    return res.send(result.rows); // return list of subscriber endpoints
});
