import { Pool } from "pg"; // installed it first 
import dotenv from "dotenv";

dotenv.config(); // loads variables from .env

export const pool = new Pool({          // connection manager for multiple dbs
    host: process.env.DB_HOST,          // connection to docker port mapping
    port: Number(process.env.DB_PORT),  // converted string to number
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});