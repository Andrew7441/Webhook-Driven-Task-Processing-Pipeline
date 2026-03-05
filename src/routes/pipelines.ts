import { Router } from "express";           // defines route groups
import { pool } from "../db/connection";    // connection pool 
import { Result } from "pg";

export const PipeLineRouter = Router();     // create a router instance for pipeline endpoints

// API POST /pipelines which creates a new pipeline
PipeLineRouter.post("/", async (req, res) => {
    const { name, source_key, action_type } = req.body ?? {}; // extract pipeline fields from req body

    if(!name || !source_key || !action_type) return res.status(400).send({ // validate required fields exist
        error: "name, source_key, and action_type are required!",
    });

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