import { Router } from "express";

export const testReceiverRouter = Router(); // Router for mock delivery test

//POST /test/receiver
//Fake subscriber endpoints used only for testing deliveries
testReceiverRouter.post("/receiver", async (req, res) => {
    console.log("Mock subscriber received: ", req.body); // log delivered payload

    return res.status(200).send({
        message: "mock subscriber received payload",
        received: req.body,
    });
});