import express from "express";
import { PipeLineRouter } from "./routes/pipelines";
import { hooksRouter } from "./routes/hooks";
import { SubscriberRouter } from "./routes/subscribers";
import { testReceiverRouter } from "./routes/testReceiver";
import { JobsRouter } from "./routes/jobs";
import { metricsRouter } from "./routes/metrics";
import { pool } from "./db/connection";
import { Response, Request, NextFunction } from "express";

const PORT = 8080;
const app = express(); // create http/express server/application

//middleware - reads incoming json request bodies and makes them available as req.body, better than listening to events, end events, parsing, etc
app.use(express.json()); // automatically checks if content type is set properly, parses the req.body, handles bad inputs

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
// /pipelines is the base path
app.use("/pipelines", PipeLineRouter); // PipeLineRouter - router that handles those requests
//inside pipelineRouter are the actual handlers

// use mount webhook endpoints under /hooks route
app.use("/hooks", hooksRouter);

app.use("/pipelines", SubscriberRouter);
// mounts the router under /pipelines
// meaning routes inside the router become:
// POST or GET /pipelines/:pipelineId/subscribers

app.use("/test", testReceiverRouter); // mounts POST /test/receiver

app.use("/jobs", JobsRouter); // mount /jobs/, etc

// Mounts metricsRouter so all HTTP requests starting with /metrics are routed to the metrics endpoints
app.use("/metrics", metricsRouter);

function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.error(err); // Log server side error

  if (res.headersSent) {
    // if response already started
    return next(err); // express handles it
  }

  return res.status(500).send({ error: "Internal Server Error" }); // generic error
}
//goes after routes so it can catch errors from the routes
app.use(errorHandler);

//starts the API server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
