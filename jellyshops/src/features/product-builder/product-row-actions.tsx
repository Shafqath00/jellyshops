"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useRef } from "react";
import type { CatalogAdminProduct } from "@/features/admin/api/catalog-api";

export function ProductRowActions({ product, busy, onStatus, onArchive, onCollection }: {
  product: CatalogAdminProduct;
  busy: boolean;
  onStatus: (status: CatalogAdminProduct["status"]) => void;
  onArchive: () => void;
  onCollection: () => void;
}) {
  const openingDialog = useRef(false);
  return <span className="product-row-actions" onClick={event => event.stopPropagation()}><Dropdown.Root modal={false} onOpenChange={open => { if (open) openingDialog.current = false; }}>
    <Dropdown.Trigger className="jk-button product-row-trigger" disabled={busy} data-product-actions={product.id} aria-label={`Actions for ${product.title}`}><MoreHorizontal size={18} aria-hidden="true" /></Dropdown.Trigger>
    <Dropdown.Portal>
      <Dropdown.Content className="product-overlay product-row-menu" align="end" sideOffset={6} collisionPadding={12} onCloseAutoFocus={event => { if (openingDialog.current) event.preventDefault(); }}>
        <Dropdown.Item asChild><Link href={`/admin/products/${product.id}`}>Edit product</Link></Dropdown.Item>
        {product.status !== "ACTIVE" && <Dropdown.Item onSelect={() => onStatus("ACTIVE")}>Set as active</Dropdown.Item>}
        {product.status !== "DRAFT" && <Dropdown.Item onSelect={() => onStatus("DRAFT")}>Set as draft</Dropdown.Item>}
        <Dropdown.Item onSelect={() => { openingDialog.current = true; onCollection(); }}>Add to collection</Dropdown.Item>
        {product.status !== "ARCHIVED" && <><Dropdown.Separator /><Dropdown.Item className="is-critical" onSelect={() => { openingDialog.current = true; onArchive(); }}>Archive product</Dropdown.Item></>}
      </Dropdown.Content>
    </Dropdown.Portal>
  </Dropdown.Root></span>;
}
