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
  expect(history.canUndo("store-b:home")).toBe(true);
});

it("keeps each page's history when switching pages and back", () => {
  const history = createSessionHistory<number>();
  history.push("store:home", 1);
  history.push("store:home", 2);
  history.push("store:product", 10);
  expect(history.canUndo("store:home")).toBe(true);
  expect(history.undo("store:home")).toBe(2);
  expect(history.undo("store:product")).toBe(10);
  expect(history.canRedo("store:home")).toBe(true);
  expect(history.redo("store:home")).toBe(2);
});

it("forgets the least recently used page beyond the page limit and clears everything", () => {
  const history = createSessionHistory<number>(50, 2);
  history.push("a", 1);
  history.push("b", 2);
  history.undo("a");
  history.push("c", 3);
  expect(history.canRedo("a")).toBe(true);
  expect(history.canUndo("b")).toBe(false);
  history.clear();
  expect(history.canUndo("c")).toBe(false);
});

it("keeps at most the step limit per page", () => {
  const history = createSessionHistory<number>(2);
  [1, 2, 3].forEach((step) => history.push("home", step));
  expect(history.undo("home")).toBe(3);
  expect(history.undo("home")).toBe(2);
  expect(history.undo("home")).toBeNull();
});
