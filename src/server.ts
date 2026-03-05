import express from "express";
import { PipeLineRouter } from "./routes/pipelines";


const app = express(); // create http server
app.use(express.json()); // parses json req bodies, needed for webhooks

//simple endpoint to confirm server works 
app.get("/health", (req, res) => {
  res.send({ status: "ok" });
});

// pipelines CRUD endpoints
app.use("/pipelines", PipeLineRouter);

const PORT = 8080;

//starts the API server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

