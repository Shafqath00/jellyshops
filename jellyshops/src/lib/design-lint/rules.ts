/**
 * Design lint rules (docs/design-contract.md, section 1). Pure functions over `PageMeasurement`.
 */
import type { PageMeasurement } from "./measure";

export type DesignRule = "edge" | "rhythm" | "headings" | "overflow" | "tap-target" | "card-ratio" | "contrast";

export interface DesignFinding {
  /** Stable id used by the baseline: rule|theme|page|device[|part]. */
  id: string;
  rule: DesignRule;
  theme: string;
  page: string;
  device: string;
  message: string;
}

export interface PageContext { theme: string; page: string; device: string }

export const DESIGN_LIMITS = {
  edgeTolerance: 1,
  centreTolerance: 4,
  /** Centred content must be clearly narrower than the page: at least this much in from each edge… */
  centredInset: 48,
  /** …or this share of the page width, whichever is smaller (phones are narrow). */
  centredInsetShare: 0.08,
  maxSectionPaddings: 3,
  maxHeadingSizes: 4,
  minTarget: 24,
  ratioTolerance: 0.02,
} as const;

export function findingId(rule: DesignRule, context: PageContext, part?: string) {
  return [rule, context.theme, context.page, context.device, ...(part ? [part] : [])].join("|");
}

function finding(rule: DesignRule, context: PageContext, message: string, part?: string): DesignFinding {
  return { id: findingId(rule, context, part), rule, ...context, message };
}

/** The value most entries share, treating values within `tolerance` as the same; ties go to the outermost value. */
export function dominantValue(values: number[], tolerance: number, preferLow: boolean): number | null {
  if (!values.length) return null;
  let best = values[0];
  let bestCount = 0;
  for (const candidate of values) {
    const count = values.filter((value) => Math.abs(value - candidate) <= tolerance).length;
    const better = count > bestCount || (count === bestCount && (preferLow ? candidate < best : candidate > best));
    if (better) { best = candidate; bestCount = count; }
  }
  return best;
}

export function pageEdges(measurement: PageMeasurement) {
  // Full-bleed parts run edge to edge by design, so they don't vote on where the page edges are.
  const withContent = measurement.parts.filter((part) => !part.fullBleed && !part.inColumn && part.left !== null && part.right !== null);
  return {
    left: dominantValue(withContent.map((part) => part.left as number), DESIGN_LIMITS.edgeTolerance, true),
    right: dominantValue(withContent.map((part) => part.right as number), DESIGN_LIMITS.edgeTolerance, false),
  };
}

export function lintPage(measurement: PageMeasurement, context: PageContext): DesignFinding[] {
  const findings: DesignFinding[] = [];
  const { edgeTolerance, centreTolerance, centredInsetShare } = DESIGN_LIMITS;

  const edges = pageEdges(measurement);
  if (edges.left !== null && edges.right !== null) {
    const centredInset = Math.min(DESIGN_LIMITS.centredInset, (edges.right - edges.left) * centredInsetShare);
    for (const part of measurement.parts) {
      if (part.inColumn) continue; // judged with the row it sits in
      if (part.fullBleed) {
        // Edge-to-edge media is fine; its text must still sit inside the page edges (a scrolling strip's text moves
        // across the whole screen by design).
        if (part.scrolling || part.textLeft === null || part.textRight === null) continue;
        if (part.textLeft < edges.left - edgeTolerance || part.textRight > edges.right + edgeTolerance) {
          findings.push(finding("edge", context, `${part.key} (full width) has text outside the page edges (text ${part.textLeft}–${part.textRight}px, page edges ${edges.left}–${edges.right}px)`, part.key));
        }
        continue;
      }
      if (part.left === null || part.right === null) continue;
      const insetLeft = part.left - edges.left;
      const insetRight = edges.right - part.right;
      const where = `content ${part.left}–${part.right}px, page edges ${edges.left}–${edges.right}px`;
      if (insetLeft < -edgeTolerance || insetRight < -edgeTolerance) {
        findings.push(finding("edge", context, `${part.key} goes outside the page edges (${where})`, part.key));
        continue;
      }
      const alignedLeft = Math.abs(insetLeft) <= edgeTolerance;
      const alignedRight = Math.abs(insetRight) <= edgeTolerance;
      const centred = Math.abs(insetLeft - insetRight) <= centreTolerance && insetLeft >= centredInset;
      if (!alignedLeft && !alignedRight && !centred) {
        findings.push(finding("edge", context, `${part.key} is not aligned to the page edges or centred (${where})`, part.key));
      }
    }
  }

  const paddings = [...new Set(measurement.parts.filter((part) => part.isSection)
    .flatMap((part) => [part.paddingTop, part.paddingBottom])
    .filter((value) => value > 0)
    .map((value) => Math.round(value)))].sort((a, b) => a - b);
  if (paddings.length > DESIGN_LIMITS.maxSectionPaddings) {
    findings.push(finding("rhythm", context, `${paddings.length} different section paddings (${paddings.join(", ")}px); at most ${DESIGN_LIMITS.maxSectionPaddings}`));
  }

  if (measurement.headingSizes.length > DESIGN_LIMITS.maxHeadingSizes) {
    findings.push(finding("headings", context, `${measurement.headingSizes.length} heading sizes (${measurement.headingSizes.join(", ")}px); at most ${DESIGN_LIMITS.maxHeadingSizes}`));
  }

  if (measurement.overflow > 0) {
    findings.push(finding("overflow", context, `page scrolls sideways by ${measurement.overflow}px`));
  }

  if (context.device === "mobile" && measurement.smallTargets.length) {
    const list = measurement.smallTargets.slice(0, 5).join("; ");
    findings.push(finding("tap-target", context, `${measurement.smallTargets.length} targets smaller than ${DESIGN_LIMITS.minTarget}px: ${list}${measurement.smallTargets.length > 5 ? "; …" : ""}`));
  }

  for (const list of measurement.cardLists) {
    if (list.ratios.length < 2) continue;
    const min = Math.min(...list.ratios);
    const max = Math.max(...list.ratios);
    if (max / min > 1 + DESIGN_LIMITS.ratioTolerance) {
      findings.push(finding("card-ratio", context, `${list.key}: card image ratios differ (${min}–${max})`, list.key));
    }
  }

  return findings;
}

export function contrastFinding(context: PageContext, targets: string[]): DesignFinding | null {
  if (!targets.length) return null;
  return finding("contrast", context, `${targets.length} low-contrast elements: ${targets.slice(0, 5).join("; ")}${targets.length > 5 ? "; …" : ""}`);
}

/** Splits findings into new ones (not in the baseline) and baseline ids that no longer occur. */
export function compareWithBaseline(findings: DesignFinding[], baseline: readonly string[]) {
  const known = new Set(baseline);
  const current = new Set(findings.map((item) => item.id));
  return {
    added: findings.filter((item) => !known.has(item.id)),
    fixed: baseline.filter((id) => !current.has(id)),
  };
}

export function findingsReport(findings: DesignFinding[], fixed: string[] = []): string {
  const lines = ["# Design lint report", "", `${findings.length} findings. Contract: docs/design-contract.md.`, ""];
  const byTheme = new Map<string, DesignFinding[]>();
  for (const item of findings) byTheme.set(item.theme, [...(byTheme.get(item.theme) ?? []), item]);
  for (const [theme, items] of byTheme) {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.rule, (counts.get(item.rule) ?? 0) + 1);
    lines.push(`## ${theme} (${items.length})`, "", [...counts].map(([rule, count]) => `${rule}: ${count}`).join(" · "), "");
    lines.push("| Rule | Page | Width | Problem |", "| --- | --- | --- | --- |");
    for (const item of items) lines.push(`| ${item.rule} | ${item.page} | ${item.device} | ${item.message.replace(/\|/g, "/")} |`);
    lines.push("");
  }
  if (fixed.length) lines.push("## Fixed since the baseline (refresh the baseline)", "", ...fixed.map((id) => `- ${id}`), "");
  return lines.join("\n");
}
