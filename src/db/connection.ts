import { Pool } from "pg";

export const pool = new Pool({ // connection manager for PostgreSQL
    host: "127.0.0.1", // connection to docker port mapping
    port: 5432,
    user: "postgres",
    password: "postgres",
    database: "postgres",
});