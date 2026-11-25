import { afterEach, expect, it } from "vitest";
import { chooseTemplateHref, forgetChosenTemplate, readChosenTemplate, rememberChosenTemplate } from "./chosen-template";

afterEach(() => localStorage.clear());

it("carries a design from the home page to sign-up and onboarding", () => {
  expect(chooseTemplateHref("jelly-halo")).toBe("/signup?template=jelly-halo");
  rememberChosenTemplate("jelly-halo");
  expect(readChosenTemplate()).toBe("jelly-halo");
  forgetChosenTemplate();
  expect(readChosenTemplate()).toBeNull();
});

it("ignores values that are not design ids", () => {
  rememberChosenTemplate("<script>");
  rememberChosenTemplate(null);
  expect(readChosenTemplate()).toBeNull();
});
