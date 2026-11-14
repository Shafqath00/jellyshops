import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { EditorTour, OPEN_TOUR_EVENT } from "./editor-tour";

afterEach(() => { try { window.localStorage.clear(); } catch { /* storage may be unavailable */ } });

it("walks a first-time user through four steps and does not come back once finished", async () => {
  const user = userEvent.setup();
  const { unmount } = render(<EditorTour />);
  expect(screen.getByRole("dialog", { name: "Click anything to edit it" })).toBeInTheDocument();
  expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("dialog", { name: "Saved as you go" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Start editing" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  unmount();
  render(<EditorTour />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("can be skipped and opened again from the menu", async () => {
  const user = userEvent.setup();
  render(<EditorTour />);
  await user.click(screen.getByRole("button", { name: "Skip" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  act(() => { window.dispatchEvent(new Event(OPEN_TOUR_EVENT)); });
  expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
});
