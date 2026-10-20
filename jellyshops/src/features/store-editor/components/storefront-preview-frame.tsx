"use client";

import { useCallback, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Renders the storefront in its own document so responsive CSS uses the chosen preview width. */
export function StorefrontPreviewFrame({
  title,
  children,
  className,
  themeId,
  style,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  themeId?: string;
  style?: CSSProperties;
}) {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const syncDocument = useCallback((frame: HTMLIFrameElement) => {
    const doc = frame.contentDocument;
    if (!doc) return;
    if (!doc.head.querySelector("meta[name='viewport']")) {
      const viewport = doc.createElement("meta");
      viewport.name = "viewport";
      viewport.content = "width=device-width, initial-scale=1";
      doc.head.append(viewport);
    }
    if (!doc.body) doc.documentElement.append(doc.createElement("body"));
    const syncStyles = () => {
      doc.head.querySelectorAll("[data-parent-style]").forEach((node) => node.remove());
      document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((source, index) => {
        const copy = source.cloneNode(true) as HTMLElement;
        copy.setAttribute("data-parent-style", String(index));
        doc.head.append(copy);
      });
    };
    syncStyles();
    let root = doc.getElementById("storefront-preview-root");
    if (!root) {
      root = doc.createElement("div");
      root.id = "storefront-preview-root";
      doc.body.append(root);
    }
    setMountNode(root);
  }, []);

  return <>
    <iframe
      title={title}
      className={className}
      srcDoc="<!doctype html><html><head></head><body style='margin:0'></body></html>"
      sandbox="allow-same-origin"
      onLoad={(event) => syncDocument(event.currentTarget)}
    />
    {mountNode ? createPortal(
      <div data-jelly-theme={themeId} style={style}>{children}</div>,
      mountNode,
    ) : null}
  </>;
}
