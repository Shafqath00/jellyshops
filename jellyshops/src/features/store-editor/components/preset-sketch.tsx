import type { PresetThumbnail } from "@jelly/storefront-registry";

/**
 * A small drawing of a preset's layout for Add section (48×32): grey blocks for media, lines for text. Decorative:
 * the button around it carries the preset's name.
 */
const media = "fill-muted-foreground/30";
const line = "fill-muted-foreground/60";

function Shapes({ kind }: { kind: PresetThumbnail }) {
  switch (kind) {
    case "split":
      return <><rect x="3" y="4" width="20" height="24" rx="1.5" className={media} /><rect x="27" y="10" width="16" height="3" rx="1" className={line} /><rect x="27" y="16" width="12" height="2" rx="1" className={line} /><rect x="27" y="21" width="8" height="3" rx="1" className={line} /></>;
    case "split-reverse":
      return <><rect x="25" y="4" width="20" height="24" rx="1.5" className={media} /><rect x="4" y="10" width="16" height="3" rx="1" className={line} /><rect x="4" y="16" width="12" height="2" rx="1" className={line} /><rect x="4" y="21" width="8" height="3" rx="1" className={line} /></>;
    case "overlay":
      return <><rect x="3" y="4" width="42" height="24" rx="1.5" className={media} /><rect x="14" y="12" width="20" height="3" rx="1" className={line} /><rect x="18" y="18" width="12" height="3" rx="1" className={line} /></>;
    case "centered":
      return <><rect x="10" y="9" width="28" height="4" rx="1" className={line} /><rect x="14" y="16" width="20" height="2" rx="1" className={line} /><rect x="19" y="21" width="10" height="3" rx="1" className={line} /></>;
    case "grid-3":
      return <>{[3, 18, 33].map((x) => <rect key={x} x={x} y="6" width="12" height="16" rx="1" className={media} />)}{[3, 18, 33].map((x) => <rect key={`t${x}`} x={x} y="24" width="9" height="2" rx="1" className={line} />)}</>;
    case "grid-4":
      return <>{[3, 14, 25, 36].map((x) => <rect key={x} x={x} y="7" width="9" height="13" rx="1" className={media} />)}{[3, 14, 25, 36].map((x) => <rect key={`t${x}`} x={x} y="22" width="7" height="2" rx="1" className={line} />)}</>;
    case "bento":
      return <><rect x="3" y="4" width="20" height="24" rx="1.5" className={media} /><rect x="25" y="4" width="9" height="11" rx="1" className={media} /><rect x="36" y="4" width="9" height="11" rx="1" className={media} /><rect x="25" y="17" width="9" height="11" rx="1" className={media} /><rect x="36" y="17" width="9" height="11" rx="1" className={media} /></>;
    case "carousel":
      return <>{[3, 16, 29].map((x) => <rect key={x} x={x} y="6" width="11" height="17" rx="1" className={media} />)}<rect x="42" y="6" width="6" height="17" rx="1" className={media} /><rect x="18" y="26" width="12" height="2" rx="1" className={line} /></>;
    case "tabs":
      return <><rect x="12" y="4" width="10" height="2.5" rx="1" className={line} /><rect x="26" y="4" width="10" height="2.5" rx="1" className={line} />{[3, 14, 25, 36].map((x) => <rect key={x} x={x} y="10" width="9" height="12" rx="1" className={media} />)}{[3, 14, 25, 36].map((x) => <rect key={`t${x}`} x={x} y="24" width="7" height="2" rx="1" className={line} />)}</>;
    case "columns-3":
      return <>{[5, 19, 33].map((x) => <g key={x}><rect x={x} y="9" width="10" height="3" rx="1" className={line} /><rect x={x} y="15" width="10" height="2" rx="1" className={line} /><rect x={x} y="19" width="7" height="2" rx="1" className={line} /></g>)}</>;
    case "columns-4":
      return <>{[3, 14, 25, 36].map((x) => <g key={x}><rect x={x} y="9" width="9" height="3" rx="1" className={line} /><rect x={x} y="15" width="9" height="2" rx="1" className={line} /><rect x={x} y="19" width="6" height="2" rx="1" className={line} /></g>)}</>;
  }
}

export function PresetSketch({ kind }: { kind: PresetThumbnail }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 48 32" className="h-8 w-12 shrink-0 rounded-md border border-border bg-muted/40" data-preset-sketch={kind}><Shapes kind={kind} /></svg>;
}
