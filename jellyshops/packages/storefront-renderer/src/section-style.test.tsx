import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { RegistrySectionRenderer } from "./registry-section-renderer";
import { sectionStyleProps } from "./section-style";

it("turns style settings into section variables", () => {
  const props = sectionStyleProps({ styleColors: true, styleBackground: "#112233", styleText: "#fafafa", styleHeadingFont: "Fraunces", styleHeadingSize: "large", styleHeadingWeight: "700", styleBodySize: "small", styleAlign: "center", styleSpacing: "none" });
  expect(props["data-section-style"]).toBe("colors heading-font heading-size heading-weight body-size align spacing");
  expect(props.style).toMatchObject({ "--section-bg": "#112233", "--section-text": "#fafafa", "--section-heading-scale": "1.2", "--section-heading-weight": "700", "--section-body-size": "14px", "--section-body-scale": "0.9", "--section-align": "center", "--section-justify": "center", "--section-space": "0px" });
  expect(String((props.style as Record<string, string>)["--section-heading-font"])).toContain("--font-fraunces");
});

it("follows the theme when nothing is chosen and ignores unsafe values", () => {
  expect(sectionStyleProps({})).toEqual({});
  expect(sectionStyleProps({ styleHeadingSize: "", styleAlign: "" })).toEqual({});
  // Colours only apply when "Use my own colours" is on.
  expect(sectionStyleProps({ styleBackground: "#112233", styleText: "#fafafa" })).toEqual({});
  expect(sectionStyleProps({ styleColors: true, styleBackground: "red;}body{display:none", styleText: "#fff" })).toEqual({});
  // One colour chosen: the other stays the theme's.
  expect(sectionStyleProps({ styleColors: true, styleBackground: "#112233" }).style).toMatchObject({ "--section-bg": "#112233", "--section-text": "var(--theme-text, #1c1b19)" });
  expect(sectionStyleProps({ styleHeadingFont: "x; color: red", styleHeadingWeight: "950" })).toEqual({});
});

it("puts the style on the section wrapper in the editor and the live store", () => {
  const section = { id: "s1", type: "rich-text", enabled: true, settings: { styleAlign: "right" }, blocks: [] };
  for (const mode of ["editor", "published"] as const) {
    const { unmount } = render(<RegistrySectionRenderer section={section} mode={mode} commerce={{ getProducts: async () => [] }} />);
    const wrapper = screen.getByTestId("section-rich-text");
    expect(wrapper).toHaveAttribute("data-section-style", "align");
    expect(wrapper.style.getPropertyValue("--section-align")).toBe("right");
    unmount();
  }
});

it("uses exact top and bottom padding and full width when chosen", () => {
  const props = sectionStyleProps({ stylePaddingTop: 24, stylePaddingBottom: 0, styleWidth: "full" });
  expect(props["data-section-style"]).toBe("pad-top pad-bottom full-width");
  expect(props.style).toMatchObject({ "--section-pad-top": "24px", "--section-pad-bottom": "0px" });
  expect(sectionStyleProps({ stylePaddingTop: 900 }).style).toMatchObject({ "--section-pad-top": "200px" });
  expect(sectionStyleProps({ stylePaddingTop: "10px", styleWidth: "page" })).toEqual({});
});

it("uses a colour scheme from theme settings unless the section has its own colours", () => {
  const props = sectionStyleProps({ styleScheme: "scheme3" });
  expect(props["data-section-style"]).toBe("colors scheme");
  expect(props.style).toMatchObject({ "--section-bg": "var(--jelly-scheme-3-bg)", "--section-button": "var(--jelly-scheme-3-button)" });
  expect(sectionStyleProps({ styleScheme: "scheme3", styleColors: true, styleBackground: "#112233" }).style).toMatchObject({ "--section-bg": "#112233", "--section-button-text": "var(--jelly-scheme-3-button-text)" });
  expect(sectionStyleProps({ styleScheme: "scheme9" })).toEqual({});
});

it("adds phone values and Show on, and ignores unknown phone values", () => {
  const props = sectionStyleProps({ stylePaddingTop: 80, styleShowOn: "desktop" }, { stylePaddingTop: 24, stylePaddingBottom: 300, styleAlign: "center", styleHeadingSize: "small" });
  expect(props["data-section-style"]).toBe("pad-top");
  expect(props["data-section-mobile"]).toBe("heading-size align pad-top pad-bottom");
  expect(props["data-show-on"]).toBe("desktop");
  expect(props.style).toMatchObject({ "--section-pad-top": "80px", "--section-pad-top-m": "24px", "--section-pad-bottom-m": "200px", "--section-align-m": "center", "--section-justify-m": "center", "--section-heading-scale-m": "0.8" });
  // A section with only phone values still gets them, with no desktop list.
  expect(sectionStyleProps({}, { styleAlign: "right" })).toEqual({ "data-section-mobile": "align", style: { "--section-align-m": "right", "--section-justify-m": "end" } });
  expect(sectionStyleProps({}, { styleAlign: "justify;}", stylePaddingTop: "12px" })).toEqual({});
  expect(sectionStyleProps({ styleShowOn: "watch" })).toEqual({});
});

it("adds shadow and opacity directly on the section wrapper", () => {
  expect(sectionStyleProps({ styleShadow: "soft", styleOpacity: 70 })).toEqual({ style: { boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)", opacity: 0.7 } });
  expect(sectionStyleProps({ styleShadow: "none", styleOpacity: 100 })).toEqual({});
  expect(sectionStyleProps({ styleShadow: "glow;}", styleOpacity: "50%" })).toEqual({});
});
