import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createPresetSection, getSectionDefinition, listSectionPresets } from "@jelly/storefront-registry";
import { fuzzSection, seededRandom } from "@/lib/settings-fuzz/generate";
import { ResetDesignButton } from "./components/inspector/reset-design-button";
import { designKeys, resetSectionDesign } from "./reset-design";

let counter = 0;
const id = () => `reset-${++counter}`;

describe("reset design", () => {
  it("puts every design setting back to its default and keeps the merchant's content and custom CSS", () => {
    const preset = listSectionPresets().find((item) => item.sectionType === "image-with-text")!;
    const original = createPresetSection(preset.id, id);
    const definition = getSectionDefinition("image-with-text")!;
    const styled = { ...fuzzSection(original, seededRandom(11), ["/photo.webp"]), responsive: { mobile: { styleAlign: "center" } } };
    styled.settings.customCss = "& { outline: 1px solid red; }";
    const reset = resetSectionDesign(styled);
    for (const key of designKeys(definition.controls)) expect(reset.settings[key], key).toEqual(definition.defaultSettings[key]);
    const contentKeys = definition.controls.filter((control) => control.group === "content" && !control.element).map((control) => control.key);
    for (const key of contentKeys) expect(reset.settings[key], key).toEqual(styled.settings[key]);
    expect(reset.settings.customCss).toBe("& { outline: 1px solid red; }");
    expect(reset.responsive).toBeUndefined();
    expect(reset.blocks.map((block) => block.id)).toEqual(styled.blocks.map((block) => block.id));
  });

  it("also resets the design of the section's blocks, keeping their text", () => {
    const preset = listSectionPresets().find((item) => item.sectionType === "custom-content")!;
    const styled = fuzzSection(createPresetSection(preset.id, id), seededRandom(5), []);
    const heading = styled.blocks.find((block) => block.type === "heading")!;
    const reset = resetSectionDesign(styled).blocks.find((block) => block.id === heading.id)!;
    expect(reset.settings.text).toBe(heading.settings.text);
    expect(reset.settings.blockTextColor).toBeUndefined();
  });

  it("asks before resetting", () => {
    const onReset = vi.fn();
    render(<ResetDesignButton onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset design to defaults" }));
    expect(onReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset design to defaults" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset design" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
