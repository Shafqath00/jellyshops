"use client";

import { m } from "framer-motion";
import { X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";
import { SheetContent } from "@/components/ui/sheet";
import { useProductMotion } from "./product-surface";

export function ProductSheetContent({ children, className = "", ...props }: ComponentProps<typeof SheetContent>) {
  const animated = useProductMotion();
  return <Dialog.Portal>
    <Dialog.Overlay className="product-backdrop" />
    <Dialog.Content asChild {...props}>
      <m.div className={`jk-sheet product-overlay product-sheet ${className}`} initial={animated ? { opacity: 0, x: 16 } : false} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
        {children}
        <Dialog.Close className="product-sheet-close jk-button" aria-label="Close"><X size={18} aria-hidden="true" /></Dialog.Close>
      </m.div>
    </Dialog.Content>
  </Dialog.Portal>;
}
