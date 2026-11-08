import crypto from "node:crypto";
import express from "express";

import { ApiError } from "../http/errors.js";
import type { ReservationSweeper } from "./sweeper.js";

function secretsMatch(
  supplied: string,
  expected: string,
): boolean {
  return (
    supplied.length === expected.length &&
    crypto.timingSafeEqual(
      Buffer.from(supplied),
      Buffer.from(expected),
    )
  );
}

export function createSweeperRouter(
  sweeper: ReservationSweeper,
  secret: string,
): express.Router {
  const router = express.Router();

  router.post(
    "/",
    async (request, response, next) => {
      try {
        const suppliedSecret =
          request.header("x-scheduler-secret") ?? "";

        if (!secretsMatch(suppliedSecret, secret)) {
          throw new ApiError(
            401,
            "SCHEDULER_UNAUTHORIZED",
            "Scheduler authorization failed.",
          );
        }

        const released = await sweeper.sweep();

        response.json({ released });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}