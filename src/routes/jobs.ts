import { Router } from "express";
import { pool } from "../db/connection";

export const JobsRouter = Router();

//GET /Jobs
//list recent jobs
JobsRouter.get("/", async (req, res) => {
    const result = await pool.query(
        `
        SELECT id, pipeline_id, status, created_at, processed_at
        FROM jobs
        ORDER BY id DESC
        LIMIT 50
        `
    );

    return res.send(result.rows);
});

//GET /Jobs/:JobId
//Get full job details including result/error
JobsRouter.get("/:JobId", async (req, res) => {
    const JobId = Number(req.params.JobId);

    //edge case
    if(!JobId) return res.status(400).send({ error: "JobId is required"});

    const result = await pool.query(
        `
        SELECT * FROM jobs
        WHERE id = $1
        `,
        [JobId]
    );

    //edge case
    if(result.rowCount === 0) return res.status(404).send({ error: "Job not found"});

    return res.send(result.rows[0]);
});

//GET /jobs/:JobId/deliveries
//show all delivery attempts for a job
JobsRouter.get("/:JobId/deliveries", async (req, res) => {
    const JobId = Number(req.params.JobId);

    //edge case
    if(!JobId) return res.status(400).send({ error: "JobId is required"});

    const result = await pool.query(
        `
        SELECT *
        FROM job_deliveries
        WHERE job_id = $1
        ORDER BY attempt ASC
        `,
        [JobId]
    );

    return res.send(result.rows);
});