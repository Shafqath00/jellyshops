import { describe, expect, it, vi } from "vitest";
import { ImageFetchError, checkImageUrl, fetchImage, isPublicAddress, type ImageFetchDeps } from "./image-fetch.js";

const PUBLIC = { address: "93.184.216.34", family: 4 };
const deps = (overrides: Partial<ImageFetchDeps> = {}): ImageFetchDeps => ({
  resolve: vi.fn(async () => [PUBLIC]),
  download: vi.fn(async () => ({ status: 200, body: Buffer.from("image-bytes") })),
  ...overrides,
});

describe("isPublicAddress", () => {
  it("accepts ordinary internet addresses", () => {
    for (const address of ["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111", "2a00:1450:4009:81f::200e"]) expect(isPublicAddress(address), address).toBe(true);
  });

  it("refuses loopback, private, link-local, metadata, shared and reserved ranges", () => {
    for (const address of [
      "127.0.0.1", "127.9.9.9", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255",
      "198.18.0.1", "192.0.2.10", "203.0.113.7", "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:192.168.0.1",
      "64:ff9b::a00:1", "2001:db8::1", "2002:7f00:1::", "not-an-address", "",
    ]) expect(isPublicAddress(address), address).toBe(false);
    expect(isPublicAddress("::ffff:8.8.8.8")).toBe(true);
    expect(isPublicAddress("172.32.0.1")).toBe(true);
  });
});

describe("checkImageUrl", () => {
  it("accepts a plain https address", () => {
    expect(checkImageUrl(" https://cdn.example.com/photos/oak bed.jpg ")).toMatchObject({ ok: true });
  });

  it("refuses anything that is not public https, with a reason in plain words", () => {
    const reason = (text: string) => { const result = checkImageUrl(text); return result.ok ? "ok" : result.reason; };
    expect(reason("http://example.com/a.jpg")).toMatch(/https:\/\//);
    expect(reason("ftp://example.com/a.jpg")).toMatch(/https:\/\//);
    expect(reason("file:///etc/passwd")).toMatch(/https:\/\//);
    expect(reason("javascript:alert(1)")).toMatch(/https:\/\//);
    expect(reason("oak-bed.jpg")).toMatch(/not a web address/);
    expect(reason("https://user:pass@example.com/a.jpg")).toMatch(/user name or password/);
    expect(reason("https://example.com:8443/a.jpg")).toMatch(/port/);
    for (const local of ["https://localhost/a.jpg", "https://printer.local/a.jpg", "https://api.internal/a.jpg", "https://intranet/a.jpg", "https://127.0.0.1/a.jpg", "https://169.254.169.254/latest/meta-data", "https://[::1]/a.jpg", "https://10.1.2.3/a.jpg"]) {
      expect(reason(local), local).toMatch(/public internet/);
    }
    expect(reason(`https://example.com/${"a".repeat(2100)}`)).toMatch(/too long/);
    expect(reason("https://example.com:443/a.jpg")).toBe("ok");
  });
});

describe("fetchImage", () => {
  it("downloads from the checked address and names the file from the path", async () => {
    const tools = deps();
    const result = await fetchImage("https://cdn.example.com/photos/oak%20bed.jpg?size=large", tools);
    expect(result).toEqual({ buffer: Buffer.from("image-bytes"), fileName: "oak bed.jpg" });
    expect(tools.resolve).toHaveBeenCalledWith("cdn.example.com");
    expect(vi.mocked(tools.download).mock.calls[0][1]).toEqual(PUBLIC);
  });

  it("refuses a name that resolves to a private address, even when only one of its addresses is private", async () => {
    const download = vi.fn();
    await expect(fetchImage("https://rebind.example.com/a.jpg", deps({ resolve: async () => [{ address: "10.0.0.8", family: 4 }], download }))).rejects.toThrow(/public internet/);
    await expect(fetchImage("https://mixed.example.com/a.jpg", deps({ resolve: async () => [PUBLIC, { address: "169.254.169.254", family: 4 }], download }))).rejects.toThrow(/public internet/);
    await expect(fetchImage("https://v6.example.com/a.jpg", deps({ resolve: async () => [{ address: "::ffff:127.0.0.1", family: 6 }], download }))).rejects.toThrow(/public internet/);
    expect(download).not.toHaveBeenCalled();
  });

  it("follows a redirect only after checking where it goes", async () => {
    const download = vi.fn()
      .mockResolvedValueOnce({ status: 302, location: "/moved/a.jpg" })
      .mockResolvedValueOnce({ status: 200, body: Buffer.from("ok") });
    expect((await fetchImage("https://cdn.example.com/a.jpg", deps({ download }))).buffer.toString()).toBe("ok");
    expect(String(download.mock.calls[1][0])).toBe("https://cdn.example.com/moved/a.jpg");

    const toMetadata = vi.fn().mockResolvedValueOnce({ status: 301, location: "https://169.254.169.254/latest/meta-data/" });
    await expect(fetchImage("https://cdn.example.com/a.jpg", deps({ download: toMetadata }))).rejects.toThrow(/public internet/);
    expect(toMetadata).toHaveBeenCalledTimes(1);

    const toHttp = vi.fn().mockResolvedValueOnce({ status: 302, location: "http://cdn.example.com/a.jpg" });
    await expect(fetchImage("https://cdn.example.com/a.jpg", deps({ download: toHttp }))).rejects.toThrow(/https/);

    const toPrivateName = vi.fn().mockResolvedValue({ status: 302, location: "https://inside.example.com/a.jpg" });
    const resolve = vi.fn(async (host: string) => host === "inside.example.com" ? [{ address: "192.168.1.20", family: 4 }] : [PUBLIC]);
    await expect(fetchImage("https://cdn.example.com/a.jpg", deps({ download: toPrivateName, resolve }))).rejects.toThrow(/public internet/);
    expect(toPrivateName).toHaveBeenCalledTimes(1);
  });

  it("gives up after a few redirects", async () => {
    const download = vi.fn().mockResolvedValue({ status: 302, location: "https://cdn.example.com/again.jpg" });
    await expect(fetchImage("https://cdn.example.com/a.jpg", deps({ download }))).rejects.toThrow(/redirects too many times/);
    expect(download).toHaveBeenCalledTimes(4);
  });

  it("explains missing, private, oversized and unreachable photos", async () => {
    const failing = (result: Awaited<ReturnType<ImageFetchDeps["download"]>>) => fetchImage("https://cdn.example.com/a.jpg", deps({ download: async () => result }));
    await expect(failing({ status: 404 })).rejects.toThrow(/not found/);
    await expect(failing({ status: 403 })).rejects.toThrow(/not public/);
    await expect(failing({ status: 500 })).rejects.toThrow(/could not be downloaded/);
    await expect(failing({ status: 200, tooLarge: true })).rejects.toThrow(/larger than 8 MB/);
    await expect(failing({ status: 200, body: Buffer.alloc(0) })).rejects.toThrow(/could not be downloaded/);
    await expect(fetchImage("https://nowhere.example.com/a.jpg", deps({ resolve: async () => { throw new Error("ENOTFOUND"); } }))).rejects.toThrow(/could not be found/);
    await expect(fetchImage("https://cdn.example.com/a.jpg", deps({ download: async () => { throw new Error("socket hang up"); } }))).rejects.toBeInstanceOf(ImageFetchError);
    await expect(fetchImage("https://cdn.example.com/a.jpg", deps({ download: async () => { throw new Error("ECONNRESET 10.0.0.1"); } }))).rejects.toThrow(/^could not be downloaded/);
  });
});
