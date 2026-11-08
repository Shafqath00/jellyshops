import type { ReactNode } from "react";
import { statusInfo, type StatusKind, type StatusTone } from "./status";

type Props =
  | { kind: StatusKind; value?: string | null; tone?: StatusTone; children?: never }
  | { kind?: never; value?: never; tone?: StatusTone; children: ReactNode };

/** A small coloured label. Pass `kind` + `value` (an API code) or your own words as children. */
export function StatusBadge(props: Props) {
  const info = props.kind ? statusInfo(props.kind, props.value) : null;
  const tone = props.tone ?? info?.tone ?? "neutral";
  return <span className={`jk-badge jk-tone-${tone}`}><span className="jk-badge-dot" aria-hidden="true" />{info ? info.label : props.children}</span>;
}
