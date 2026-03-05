import { Pool } from "pg"; // installed it first 

export const pool = new Pool({ // connection manager for multiple dbs
    host: "127.0.0.1", // connection to docker port mapping
    port: 5432,
    user: "postgres",
    password: "postgres",
    database: "postgres",
});