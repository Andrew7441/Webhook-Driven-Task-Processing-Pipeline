import { Router } from "express";           // defines route groups
import { pool } from "../db/connection";    // connection pool 

export const PipeLineRouter = Router();     // create a router instance for pipeline endpoints

const ALLOWED_ACTION_TYPES = [
    "extract_commits",
    "uppercase_repo",
    "echo",
    "lowercase_repo",
    "count_payload_keys",
] as const;

//API POST /pipelines 
//creates a new pipeline
PipeLineRouter.post("/", async (req, res) => {
    const { name, source_key, action_type } = req.body ?? {}; // extract pipeline fields from req body
    
    //edge case
    if(!name || !source_key || !action_type) return res.status(400).send({ // validate required fields exist
        error: "name, source_key, and action_type are required!",
    });

    if(!ALLOWED_ACTION_TYPES.includes(action_type)) return res.status(400).send({error: "invalid action type"});

    try{
        // insert pipeline into db and return created record
        const result = await pool.query(
            `
            INSERT INTO pipelines (name, source_key, action_type)
            VALUES ($1, $2, $3)
            RETURNING id, name, source_key, action_type, created_at
            `,
            [name, source_key, action_type]
        );

        return res.status(201).send(result.rows[0]);
    }catch(err: any){
        console.log(err);
        if(err?.code === "23505"){
            return res.status(409).send({error: "source_key already exists"}); // postgres error code for unique constraint violation
        }

        return res.status(500).send({ error: "internal server error"}); // generic server error
    }
});


//API GET /pipelines which lists all pipelines
PipeLineRouter.get("/", async (req, res) => {

    //fetch pipelines from database, newest first 
    const result = await pool.query(
        `
        SELECT * FROM pipelines 
        ORDER BY id DESC
        `
    );

    //return array of pipelines
    return res.send(result.rows);
});

//GET /pipelines/:pipelineId
//get a single pipeline by Id
PipeLineRouter.get("/:pipelineId", async (req, res) => {
    const pipelineId = Number(req.params.pipelineId);

    if(!pipelineId) return res.status(400).send({error: "pipelineId is required"}); // 400 for bad request


    const result = await pool.query(
        `
        SELECT * FROM pipelines
        WHERE id = $1
        `,
        [pipelineId]
    );

    if(result.rowCount === 0) return res.status(404).send({error:  "Pipeline not found"}); // 404 for not found

    return res.send(result.rows[0]);
});

//PUT /pipelines/:pipelineId
// update a single pipeline by Id
PipeLineRouter.put("/:pipelineId", async (req, res) =>{
    const pipelineId = Number(req.params.pipelineId); // extract id from url
    const { name, source_key, action_type } = req.body ?? {}; // fields to update

    //edge case
    if(!pipelineId) return res.status(400).send({ error: "pipelineId is required"});

    //edge case 
    if(!name && !source_key && !action_type) return res.status(400).send({ error: "At least one field is required to update"});

    if(action_type && !ALLOWED_ACTION_TYPES.includes(action_type)) res.status(400).send({ error: "action type is invalid"});

    try{
        //update pipeline Fields and keep old values if a field was not provided

        const result = await pool.query(
            `
            UPDATE pipelines
            SET name = COALESCE($2, name),
                source_key = COALESCE($3, source_key),
                action_type = COALESCE($4, action_type)
            WHERE id = $1
            RETURNING *
            `,
            [pipelineId, name, source_key, action_type]
        );

        //edge case
        if(result.rowCount === 0) return res.status(404).send({error : "pipeline not found"});

        return res.send(result.rows[0]);

    }catch(err: any){
        if(err?.code === "23505") return res.status(409).send({error: "source_key already exists"});

        return res.status(500).send({ error: "internal server error"});
    }
});

//DELETE /pipelines/:pipelineId
//delete a single pipeline by id
PipeLineRouter.delete("/:pipelineId", async (req, res) => {
    const pipelineId = Number(req.params.pipelineId);

    //edge case
    if(!pipelineId) return res.status(400).send({ error: "pipelineId is required"});

    const result = await pool.query(
        `
        DELETE FROM pipelines
        WHERE id = $1
        RETURNING * 
        `,
        [pipelineId]
    );

    if(result.rowCount === 0) return res.status(404).send({ error: "pipeline not found"});

    return res.send({
        message: "Pipeline deleted successfully",
        pipeline: result.rows[0]
    });
});