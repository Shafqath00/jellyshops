import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OrderPaymentPanel } from "./order-payment-panel";

const payment = {
  id: "payment-1",
  status: "PAID" as const,
  amountMinor: 129900,
  currency: "INR",
  paymentIntentId: "pi_123",
  chargeId: "ch_123",
};

describe("OrderPaymentPanel", () => {
  it("requires explicit confirmation before requesting the one supported full refund", async () => {
    const user = userEvent.setup();
    const requestFullRefund = vi.fn().mockResolvedValue({
      id: "refund-1",
      status: "PENDING",
      amountMinor: 129900,
      stripeRefundId: null,
    });
    render(<OrderPaymentPanel payment={payment} refunds={[]} disputes={[]} fulfilmentStatus="CONFIRMED" requestFullRefund={requestFullRefund} />);

    await user.click(screen.getByRole("button", { name: /issue full refund/i }));

    expect(screen.getByRole("dialog", { name: /confirm full refund/i })).toBeVisible();
    expect(requestFullRefund).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^confirm refund$/i }));

    await waitFor(() => expect(requestFullRefund).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/refund is pending/i)).toBeVisible();
  });

  it("shows a pending refund as a separate payment state", () => {
    render(<OrderPaymentPanel payment={payment} refunds={[{ id: "refund-1", status: "PENDING", amountMinor: 129900, stripeRefundId: null }]} disputes={[]} fulfilmentStatus="CONFIRMED" requestFullRefund={vi.fn()} />);

    expect(screen.getByText(/refund is pending/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: /issue full refund/i })).not.toBeInTheDocument();
  });

  it("shows a failed refund without presenting it as a fulfilment change", () => {
    render(<OrderPaymentPanel payment={payment} refunds={[{ id: "refund-1", status: "FAILED", amountMinor: 129900, stripeRefundId: "re_123" }]} disputes={[]} fulfilmentStatus="CONFIRMED" requestFullRefund={vi.fn()} />);

    expect(screen.getByText(/refund failed/i)).toBeVisible();
    expect(screen.getByText("Fulfilment: confirmed")).toBeVisible();
  });

  it("shows a dispute without changing the fulfilment state shown to the merchant", () => {
    render(<OrderPaymentPanel payment={payment} refunds={[]} disputes={[{ stripeDisputeId: "dp_123", status: "needs_response" }]} fulfilmentStatus="SHIPPED" requestFullRefund={vi.fn()} />);

    expect(screen.getByText("Fulfilment: shipped")).toBeVisible();
    expect(screen.getByText(/payment dispute: needs response/i)).toBeVisible();
  });
});
