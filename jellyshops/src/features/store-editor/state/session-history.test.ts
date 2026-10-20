import { expect, it } from "vitest";
import { createSessionHistory } from "./session-history";
it("undoes and redoes changes, drops redo after a new edit, and isolates store/template scopes", () => {
  const history = createSessionHistory<{ before: number; after: number }>();
  history.push("store-a:home", { before: 0, after: 1 });
  history.push("store-a:home", { before: 1, after: 2 });
  expect(history.undo("store-a:home")).toEqual({ before: 1, after: 2 });
  expect(history.redo("store-a:home")).toEqual({ before: 1, after: 2 });
  history.undo("store-a:home"); history.push("store-a:home", { before: 1, after: 3 });
  expect(history.redo("store-a:home")).toBeNull();
  expect(history.undo("store-b:home")).toBeNull();
  history.push("store-b:home", { before: 0, after: 1 });
  expect(history.canUndo("store-a:home")).toBe(false);
});
