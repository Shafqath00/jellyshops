import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProductMediaLike } from "@jelly/storefront-schema";
import type { MediaRecord } from "@/features/store-editor/api/types";
import { PhotosSection } from "./sections/photos-section";
const photo = (id: string): ProductMediaLike => ({ id, url: `https://example.com/${id}.jpg`, appliesTo: {} });
function Gallery({ upload }: { upload?: (file: File, progress: (percent: number) => void) => Promise<MediaRecord> }) {
  const [media, setMedia] = useState([photo("one"), photo("two")]);
  return <><PhotosSection media={media} options={[]} taggingEnabled onChange={setMedia} onUpload={upload} /><output aria-label="Gallery order">{media.map((item) => item.id).join(",")}</output></>;
}
describe("seller photo gallery", () => {
  it("explains how to add the first product photo", () => {
    render(<PhotosSection media={[]} options={[]} taggingEnabled onChange={() => {}} onUpload={async () => ({ ...photo("new") } as MediaRecord)} />);
    expect(screen.getByText(/add your first product photo/i)).toBeVisible();
  });

  it("identifies the cover photo and groups its actions", () => {
    const upload = async (_file: File, _progress: (percent: number) => void) => ({ ...photo("new") } as MediaRecord);
    render(<Gallery upload={upload} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit photo 1" }));
    const cover = screen.getByRole("dialog");

    expect(within(cover).getByLabelText("Alt text for photo 1")).toBeInTheDocument();
    expect(within(cover).getByRole("button", { name: "Move photo 1 down" })).toBeEnabled();
    expect(within(cover).getByLabelText("Replace photo 1")).toBeInTheDocument();
    expect(within(cover).getByRole("button", { name: "Remove photo 1" })).toBeInTheDocument();
  });

  it("changes the cover with keyboard accessible reorder buttons and unlinks without deleting", () => {
    render(<Gallery />);
    fireEvent.click(screen.getByRole("button", { name: "Edit photo 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Move photo 2 up" }));
    expect(screen.getByLabelText("Gallery order")).toHaveTextContent("two,one");
    fireEvent.click(screen.getByRole("button", { name: "Remove photo 1" }));
    expect(screen.getByLabelText("Gallery order")).toHaveTextContent("one");
  });
  it("retains a failed file for retry and appends the successful upload", async () => {
    let attempts = 0;
    const upload = async (_file: File, progress: (percent: number) => void) => { if (++attempts === 1) throw new Error("Connection lost"); progress(50); return { ...photo("three"), width: 200, height: 200 } as MediaRecord; };
    render(<Gallery upload={upload} />);
    fireEvent.change(screen.getByLabelText("Add product photos"), { target: { files: [new File(["x"], "front.jpg", { type: "image/jpeg" })] } });
    fireEvent.click(await screen.findByRole("button", { name: "Retry front.jpg" }));
    await waitFor(() => expect(screen.getByLabelText("Gallery order")).toHaveTextContent("one,two,three"));
    fireEvent.click(screen.getByRole("button", { name: "Edit photo 3" }));
    expect(screen.getByText(/Small photo/)).toBeInTheDocument();
  });
  it("uses the latest gallery when an upload finishes after an external update", async () => {
    let finish!: (record: MediaRecord) => void;
    const upload = () => new Promise<MediaRecord>((resolve) => { finish = resolve; });
    const changes: ProductMediaLike[][] = [];
    const props = { options: [], taggingEnabled: false, onChange: (value: ProductMediaLike[]) => changes.push(value), onUpload: upload };
    const { rerender } = render(<PhotosSection {...props} media={[photo("one")]} />);
    fireEvent.change(screen.getByLabelText("Add product photos"), { target: { files: [new File(["x"], "front.jpg", { type: "image/jpeg" })] } });
    rerender(<PhotosSection {...props} media={[photo("one"), photo("two")]} />);
    finish(photo("three") as MediaRecord);
    await waitFor(() => expect(changes.at(-1)?.map((item) => item.id)).toEqual(["one", "two", "three"]));
  });
});
