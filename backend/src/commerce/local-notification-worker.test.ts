import { describe, expect, it, vi } from "vitest";
import { localNotificationWorkerConfig, runLocalNotificationWorker } from "./local-notification-worker.js";

describe("local notification worker", () => {
  it("preserves the Firebase function prefix and uses the email-only route", () => {
    expect(localNotificationWorkerConfig({ ORDER_PUBLIC_API_URL: "http://127.0.0.1:5001/project/us-central1/api/", SCHEDULER_SECRET: "test-secret" }).endpoint)
      .toBe("http://127.0.0.1:5001/project/us-central1/api/internal/commerce/notifications/work");
  });

  it("refuses remote destinations and missing scheduler credentials", () => {
    expect(() => localNotificationWorkerConfig({ ORDER_PUBLIC_API_URL: "https://example.com", SCHEDULER_SECRET: "secret" })).toThrow(/local/i);
    expect(() => localNotificationWorkerConfig({})).toThrow(/SCHEDULER_SECRET/);
  });

  it("checks the queue without triggering delivery", async () => {
    const requests: Array<{ method: string; secret: string }> = [];
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      requests.push({ method: init.method!, secret: new Headers(init.headers).get("x-scheduler-secret")! });
      return new Response(JSON.stringify({ queued: 5 }));
    });
    const result = await runLocalNotificationWorker(localNotificationWorkerConfig({ SCHEDULER_SECRET: "secret" }), { check: true, fetch: fetcher as typeof fetch });
    expect(result).toEqual({ queued: 5 });
    expect(requests).toEqual([{ method: "GET", secret: "secret" }]);
  });

  it("runs one email batch with scheduler authentication", async () => {
    let request: RequestInit | undefined;
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => { request = init; return new Response(JSON.stringify({ processed: 1 })); });
    await expect(runLocalNotificationWorker(localNotificationWorkerConfig({ SCHEDULER_SECRET: "secret" }), { once: true, fetch: fetcher as typeof fetch })).resolves.toEqual({ processed: 1 });
    expect(request?.method).toBe("POST");
    expect(new Headers(request?.headers).get("x-scheduler-secret")).toBe("secret");
  });
});
