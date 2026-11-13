import { describe, expect, it } from "vitest";
import { csvCell } from "./csv-cell";

describe("csvCell", () => {
  it("quotes every value and doubles quotes inside it", () => {
    expect(csvCell("Oak bed")).toBe('"Oak bed"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(42)).toBe('"42"');
  });

  it("stops a value from running as a spreadsheet formula", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("\"'=HYPERLINK(1)\"");
    expect(csvCell("+44 20 7946 0000")).toBe("\"'+44 20 7946 0000\"");
    expect(csvCell("-5")).toBe("\"'-5\"");
    expect(csvCell("@name")).toBe("\"'@name\"");
    expect(csvCell("a=b")).toBe('"a=b"');
  });
});
