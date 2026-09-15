import clsx from "clsx";

import {
  StorefrontRenderer,
  type CommerceDataProvider,
} from "@jelly/storefront-renderer";
import type { StorefrontDocument } from "@jelly/storefront-schema";

import type { EditorSelection } from "../model/types";
import type { EditorViewport } from "../state/types";

export function PreviewCanvas({
  document,
  viewport,
  selection,
  commerce,
  onSelect,
}: {
  document: StorefrontDocument;
  viewport: EditorViewport;
  selection: EditorSelection;
  commerce: CommerceDataProvider;
  onSelect(selection: EditorSelection): void;
}) {
  return (
    <main
      className="h-full min-h-0 overflow-auto"
      aria-label="Storefront preview"
    >
      <div className="flex min-h-full justify-center px-1 pb-8">
        <div
          data-testid="preview-viewport"
          data-viewport={viewport}
          className={clsx(
            "relative min-h-full overflow-hidden bg-white",
            "border border-[#dcdcdc]",
            "shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
            "transition-[max-width,width] duration-200 ease-out",

            viewport === "desktop" &&
              "w-full max-w-[1440px]",

            viewport === "tablet" &&
              "w-full max-w-[820px]",

            viewport === "mobile" &&
              "w-full max-w-[390px]"
          )}
        >
          <StorefrontRenderer
            document={document}
            mode="editor"
            commerce={commerce}
            selected={
              selection ?? undefined
            }
            onSelect={(next) => {
              if (
                next.kind === "block" &&
                next.region &&
                next.sectionId &&
                next.blockId
              ) {
                onSelect({
                  kind: "block",
                  region: next.region,
                  sectionId:
                    next.sectionId,
                  blockId: next.blockId,
                  fieldKey:
                    next.fieldKey,
                });

                return;
              }

              if (
                next.kind ===
                  "section" &&
                next.region &&
                next.sectionId
              ) {
                onSelect({
                  kind: "section",
                  region: next.region,
                  sectionId:
                    next.sectionId,
                });
              }
            }}
          />
        </div>
      </div>
    </main>
  );
}