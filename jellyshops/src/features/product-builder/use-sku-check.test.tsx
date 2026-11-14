import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { skuTakenMessage, useSkuCheck, type FindBySku, type SkuOwner } from "./use-sku-check";

const products: SkuOwner[] = [
  { id: "p1", title: "Oak bed", variants: [{ sku: "OAK-D" }, { sku: null }] },
  { id: "p2", title: "Oak bench", variants: [{ sku: "OAK-D-2" }] },
];

describe("skuTakenMessage", () => {
  it("names the other product that uses the code, whatever its capitals", () => {
    expect(skuTakenMessage(" oak-d ", products, null)).toBe("“Oak bed” already uses this stock code. Each item needs its own.");
    expect(skuTakenMessage("OAK-D-2", products, "p1")).toMatch(/Oak bench/);
  });

  it("is quiet for the product's own code, a code that only looks similar, and an empty one", () => {
    expect(skuTakenMessage("OAK-D", products, "p1")).toBe("");
    expect(skuTakenMessage("OAK", products, null)).toBe("");
    expect(skuTakenMessage("  ", products, null)).toBe("");
  });
});

function Probe({ sku, find }: { sku: string; find: FindBySku | null }) {
  return <p role="status">{useSkuCheck(sku, "p9", find, 300)}</p>;
}

describe("useSkuCheck", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  const settle = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

  it("looks once typing pauses and warns when the code is taken", async () => {
    const find = vi.fn(async () => products);
    const view = render(<Probe sku="OA" find={find} />);
    view.rerender(<Probe sku="OAK" find={find} />);
    view.rerender(<Probe sku="OAK-D" find={find} />);
    await settle(200);
    expect(find).not.toHaveBeenCalled();
    await settle(200);
    expect(find).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalledWith("OAK-D");
    expect(screen.getByRole("status")).toHaveTextContent("“Oak bed” already uses this stock code");
    // Changing the code hides the old answer straight away.
    view.rerender(<Probe sku="OAK-DX" find={find} />);
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("says nothing for very short codes, with no lookup available, or when the lookup fails", async () => {
    const find = vi.fn(async () => { throw new Error("offline"); });
    const view = render(<Probe sku="O" find={find} />);
    await settle(400);
    expect(find).not.toHaveBeenCalled();
    view.rerender(<Probe sku="OAK-D" find={null} />);
    await settle(400);
    view.rerender(<Probe sku="OAK-D" find={find} />);
    await settle(400);
    expect(find).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});
