import { afterEach, describe, expect, it, vi } from "vitest";
import { HOME_THEME_KEY, HOME_THEME_SCRIPT, nextThemeChoice, readThemeChoice, setThemeChoice } from "./theme";

type Listener = (event: { matches: boolean }) => void;

/** A fake prefers-color-scheme query the test can flip, like a visitor changing their system setting. */
function fakeSystem(light: boolean) {
  const listeners: Listener[] = [];
  const query = { matches: light, addEventListener: (_: string, fn: Listener) => listeners.push(fn) };
  vi.stubGlobal("matchMedia", () => query);
  return { set(next: boolean) { query.matches = next; listeners.forEach((fn) => fn({ matches: next })); } };
}

const run = () => new Function(HOME_THEME_SCRIPT)();
const root = () => document.documentElement.dataset;

afterEach(() => {
  localStorage.clear();
  delete root().homeTheme;
  delete root().homeThemeChoice;
  delete window.__jellyTheme;
  vi.unstubAllGlobals();
});

describe("brand theme", () => {
  it("follows the system by default and updates when it changes", () => {
    const system = fakeSystem(false);
    run();
    expect(root()).toMatchObject({ homeTheme: "dark", homeThemeChoice: "system" });
    system.set(true);
    expect(root().homeTheme).toBe("light");
  });

  it("keeps a saved choice over the system setting", () => {
    const system = fakeSystem(false);
    localStorage.setItem(HOME_THEME_KEY, "light");
    run();
    expect(root()).toMatchObject({ homeTheme: "light", homeThemeChoice: "light" });
    system.set(false);
    expect(root().homeTheme).toBe("light");
  });

  it("ignores unknown saved values", () => {
    fakeSystem(true);
    localStorage.setItem(HOME_THEME_KEY, "sepia");
    run();
    expect(root()).toMatchObject({ homeTheme: "light", homeThemeChoice: "system" });
  });

  it("cycles System, Light, Dark and forgets the choice on System", () => {
    fakeSystem(true);
    run();
    expect(nextThemeChoice("system")).toBe("light");
    expect(nextThemeChoice("light")).toBe("dark");
    expect(nextThemeChoice("dark")).toBe("system");
    setThemeChoice("dark");
    expect(readThemeChoice()).toBe("dark");
    expect(root().homeTheme).toBe("dark");
    setThemeChoice("system");
    expect(localStorage.getItem(HOME_THEME_KEY)).toBeNull();
    expect(root().homeTheme).toBe("light");
  });
});
