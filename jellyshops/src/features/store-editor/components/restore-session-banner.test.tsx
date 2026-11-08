import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { RestoreSessionBanner } from "./restore-session-banner";

it("says what was not saved and lets the merchant restore or discard it", async () => {
  const user = userEvent.setup();
  const onRestore = vi.fn();
  const onDiscard = vi.fn();
  render(<RestoreSessionBanner summary="2 pages and theme settings" savedAt={Date.UTC(2026, 9, 31, 10, 30)} onRestore={onRestore} onDiscard={onDiscard} />);
  const region = screen.getByRole("region", { name: "Restore your last session" });
  expect(region).toHaveTextContent("2 pages and theme settings");
  expect(region).toHaveTextContent("Restoring replaces what is saved now.");
  await user.click(screen.getByRole("button", { name: "Restore changes" }));
  await user.click(screen.getByRole("button", { name: "Discard" }));
  expect(onRestore).toHaveBeenCalledTimes(1);
  expect(onDiscard).toHaveBeenCalledTimes(1);
});
