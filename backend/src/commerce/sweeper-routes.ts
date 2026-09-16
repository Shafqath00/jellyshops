import express from "express";
import crypto from "node:crypto";
import type { ReservationSweeper } from "./sweeper.js";

export function createSweeperRouter(sweeper: ReservationSweeper, secret: string): express.Router {
  const router = express.Router();
  router.post("/", async (request, response, next) => {
    try {
      const supplied = String(request.header("x-scheduler-secret") ?? "");
      const valid = supplied.length === secret.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
      if (!valid) return response.status(401).json({ error: { code: "SCHEDULER_UNAUTHORIZED" } });
      response.json({ released: await sweeper.sweep() });
    } catch (error) { next(error); }
  });
  return router;
}
