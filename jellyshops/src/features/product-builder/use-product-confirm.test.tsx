import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { useProductConfirm } from "./use-product-confirm";

function Harness({ nested = false }: { nested?: boolean }) {
  const confirmation = useProductConfirm();
  const [dirty, setDirty] = useState(true);
  const content = <>{dirty && <button onClick={async () => {
    if (await confirmation.ask({ title: "Discard changes?", description: "Changes will be lost.", confirmLabel: "Discard changes" })) setDirty(false);
  }}>Discard</button>}{nested && <button className="product-sheet-close">Close photo library</button>}</>;
  return <div className="product-surface"><label>Product name<input id="pb-title" /></label>{nested ? <div role="dialog" aria-label="Photo library">{content}</div> : content}{confirmation.dialog}</div>;
}

describe("product confirmation focus", () => {
  it("focuses a stable editor field when Discard removes its own trigger", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Discard" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(screen.getByLabelText("Product name")).toHaveFocus());
  });

  it("keeps focus inside the underlying sheet when a nested action removes its trigger", async () => {
    const user = userEvent.setup();
    render(<Harness nested />);
    await user.click(screen.getByRole("button", { name: "Discard" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Close photo library" })).toHaveFocus());
  });
});
