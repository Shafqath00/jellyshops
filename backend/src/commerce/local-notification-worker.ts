import { setTimeout as delay } from "node:timers/promises";

export function localNotificationWorkerConfig(environment: NodeJS.ProcessEnv) {
  const secret = environment.SCHEDULER_SECRET?.trim();
  if (!secret) throw new Error("SCHEDULER_SECRET is required for the local notification worker");
  const base = new URL(environment.ORDER_PUBLIC_API_URL || `http://127.0.0.1:${environment.PORT || 3001}`);
  if (!["http:", "https:"].includes(base.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) || base.username || base.password || base.search || base.hash) {
    throw new Error("The local notification worker requires a local API URL without credentials, query, or fragment");
  }
  return { endpoint: `${base.href.replace(/\/$/, "")}/internal/commerce/notifications/work`, secret };
}

export async function runLocalNotificationWorker(
  config: ReturnType<typeof localNotificationWorkerConfig>,
  options: { check?: boolean; once?: boolean; signal?: AbortSignal; intervalMs?: number; fetch?: typeof fetch; onResult?: (result: unknown) => void; onError?: (error: unknown) => void } = {},
): Promise<unknown> {
  const fetcher = options.fetch ?? fetch;
  while (!options.signal?.aborted) {
    try {
      const response = await fetcher(config.endpoint, {
        method: options.check ? "GET" : "POST",
        headers: { "x-scheduler-secret": config.secret },
        redirect: "error",
        signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(55000)]) : AbortSignal.timeout(55000),
      });
      if (!response.ok) throw new Error(`Notification worker returned HTTP ${response.status}`);
      const result: unknown = await response.json();
      if (options.check || options.once) return result;
      options.onResult?.(result);
    } catch (error) {
      if (options.signal?.aborted) return;
      if (options.check || options.once) throw error;
      options.onError?.(error);
    }
    // Await each request and pause afterwards; slow SMTP requests never overlap.
    try { await delay(options.intervalMs ?? 10000, undefined, { signal: options.signal }); }
    catch (error) { if (!options.signal?.aborted) throw error; }
  }
}
