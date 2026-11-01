import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { LanguageSwitcher, StorefrontLanguageContext, useStorefrontLanguageState } from "./storefront-language";

function Harness() {
  const state = useStorefrontLanguageState("shop", [{ code: "hi", name: "हिन्दी" }], "English");
  return <StorefrontLanguageContext.Provider value={state}><LanguageSwitcher /><output>{state.language ?? "main"}</output></StorefrontLanguageContext.Provider>;
}

it("lets shoppers pick a language, remembers it, and ignores unknown ones", async () => {
  window.localStorage.setItem("jelly-language:shop", "xx");
  render(<Harness />);
  await act(async () => {});
  expect(screen.getByRole("status")).toHaveTextContent("main");
  fireEvent.change(screen.getByRole("combobox", { name: "Language" }), { target: { value: "hi" } });
  expect(screen.getByRole("status")).toHaveTextContent("hi");
  expect(window.localStorage.getItem("jelly-language:shop")).toBe("hi");
});
