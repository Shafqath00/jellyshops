/**
 * Plain-language messages for checkout problems. Shoppers never see API codes.
 */

const BY_CODE: Record<string, string> = {
  OUT_OF_STOCK: "Something in your bag has just sold out. Go back to your bag to check the quantities.",
  CHECKOUT_RATE_LIMITED: "Too many tries in a short time. Wait a minute, then try again.",
  CHECKOUT_DELIVERY_COUNTRY_INVALID: "This shop only delivers within its own country. Check the delivery address.",
  MERCHANT_PAYMENTS_UNAVAILABLE: "This shop isn't taking payments yet. Please contact the shop.",
  MARKET_PAYMENTS_UNAVAILABLE: "This shop can't take payments in your country yet.",
  CHECKOUT_CURRENCY_MISMATCH: "The shop's prices have changed. Refresh the page and try again.",
  CHECKOUT_INPUT_INVALID: "Some of your details look incomplete. Check them and try again.",
  CHECKOUT_ATTEMPT_UNAVAILABLE: "Your checkout timed out. Press Continue to payment again.",
  PAYMENT_PREPARATION_RETRY: "We couldn't get the payment ready. Try again in a moment.",
  PAYMENT_NOT_CONFIRMABLE: "This payment is already being processed. Check your email before trying again.",
};

export interface CheckoutProblem {
  message: string;
  /** True when trying again might work without changing anything. */
  retryable: boolean;
}

export function checkoutProblem(error: unknown): CheckoutProblem {
  if (error instanceof TypeError) {
    return { message: "We couldn't reach the shop. Check your connection and try again.", retryable: true };
  }
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status: unknown }).status) : undefined;
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : undefined;
  if (code && BY_CODE[code]) return { message: BY_CODE[code], retryable: code === "PAYMENT_PREPARATION_RETRY" || code === "CHECKOUT_RATE_LIMITED" };
  if (status === 429) return { message: BY_CODE.CHECKOUT_RATE_LIMITED!, retryable: true };
  if (status && status >= 500) return { message: "Something went wrong on our side. Nothing has been charged. Try again in a moment.", retryable: true };
  const message = error instanceof Error ? error.message : "";
  // Server messages are written for people; codes (SHOUTY_SNAKE) are not.
  if (message && !/^[A-Z0-9_]+$/.test(message) && message !== "Commerce request failed") return { message, retryable: false };
  return { message: "We couldn't start your payment. Nothing has been charged. Try again.", retryable: true };
}
