import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createOrderWorkerRouter } from "./order-runtime.js";
import { errorHandler } from "../http/errors.js";

function setup() {
  const send = vi.fn(async () => ({ processed: 1 }));
  const status = vi.fn(async () => ({ counts: { QUEUED: 5 } }));
  const app = express();
  app.use("/worker", createOrderWorkerRouter(send, "scheduler-secret", status));
  app.use(errorHandler);
  return { app, send, status };
}

describe("notification worker access", () => {
  it("reads queue status without running delivery", async () => {
    const { app, send } = setup();
    const response = await request(app).get("/worker").set("x-scheduler-secret", "scheduler-secret");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ counts: { QUEUED: 5 } });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(send).not.toHaveBeenCalled();
  });

  it.each(["get", "post"] as const)("denies unauthenticated %s requests", async (method) => {
    const { app, send, status } = setup();
    expect((await request(app)[method]("/worker")).status).toBe(401);
    expect(send).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it("runs the email callback only for an authenticated POST", async () => {
    const { app, send, status } = setup();
    expect((await request(app).post("/worker").set("x-scheduler-secret", "scheduler-secret")).body).toEqual({ processed: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });
});
