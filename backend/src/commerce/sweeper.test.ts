import { it, expect, vi } from "vitest";
import { ReservationSweeper } from "./sweeper.js";

it("cancels an expired intent before releasing its attempt", async () => {
  const tx = { query: vi.fn(async (sql: string) => sql.replace(/\s+/g, " ").includes("SELECT ca") ? { rows: [{ id: "a", orderId: "o", storeId: "s", paymentIntentId: "pi", stripeAccountId: "acct" }] } : { rows: [{ id: "o" }] }) };
  const repo = { transaction: vi.fn(async (work: any) => work(tx)), releaseAttempt: vi.fn() } as any;
  const stripe = { cancelPaymentIntent: vi.fn(async () => ({ id: "pi" })) } as any;
  await new ReservationSweeper(repo, stripe).sweep();
  expect(stripe.cancelPaymentIntent).toHaveBeenCalledWith("pi", expect.objectContaining({ connectedAccountId: "acct" }));
  expect(repo.releaseAttempt).toHaveBeenCalledWith("a");
  expect(repo.releaseAttempt).toHaveBeenCalledTimes(1);
});
