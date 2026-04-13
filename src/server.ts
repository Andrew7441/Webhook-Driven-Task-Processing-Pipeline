import express from "express";
import { PipeLineRouter } from "./routes/pipelines";
import { hooksRouter } from "./routes/hooks";
import { SubscriberRouter } from "./routes/subscribers";
import { testReceiverRouter } from "./routes/testReceiver";
import { JobsRouter } from "./routes/jobs";
import { metricsRouter } from "./routes/metrics";
import { pool } from "./db/connection";

const PORT = 8080;

const app = express(); // create http server
app.use(express.json()); // parses json req bodies, needed for webhooks

//simple endpoint to confirm server works
app.get("/health", (req, res) => {
  res.send({ Status: "Ok" });
});

// simple DB connectivity check
app.get("/server", async (req, res) => {
  try {
    const result = await pool.query(`SELECT 1`); // query to test DB
    if (result.rowCount === 1)
      return res.send({ Status: "Ok", DataBase: "Ready" });

    throw new Error("DB query failed");
  } catch {
    return res.status(503).send({ status: "error", db: "disconnected" });
  }
});

// pipelines CRUD endpoints
app.use("/pipelines", PipeLineRouter);

// mount webhook endpoints under /hooks
app.use("/hooks", hooksRouter);

app.use("/pipelines", SubscriberRouter);
// mounts the router under /pipelines
// meaning routes inside the router become:
// POST or GET /pipelines/:pipelineId/subscribers

app.use("/test", testReceiverRouter); // mounts POST /test/receiver

app.use("/jobs", JobsRouter); // mount /jobs/, etc

app.use("/metrics", metricsRouter); // mount metrics

//starts the API server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
