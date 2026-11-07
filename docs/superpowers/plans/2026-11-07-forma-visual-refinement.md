# Forma visual refinement

**Goal:** Correct the measured Hyper/Forma composition gaps from docs/reports/2026-11-07-hyper-forma-visual-audit.md.
**Architecture:** Keep the CLI theme and shared section frames. Exclude Forma from legacy visual defaults without changing their specificity for existing themes. Use compact theme-owned geometry and the existing interactive gallery; make sample options configurable without changing other previews.

- [x] Add failing browser assertions: desktop hero top <=360px and height <=520px; phone hero top <=300px and CTA within 844px; gallery thumbnails; purchase-column gaps <=24px.
- [x] Scope conflicting legacy defaults away from Forma; preserve every other theme's selector specificity.
- [x] Replace hero/category imagery and copy, and set header/category/hero proportions deliberately at 1280/820/390px.
- [x] Use realistic configurable preview options and same-product media. Enable the shared thumbnail viewer for Forma only and compact the product grid rows.
- [x] Regenerate styles/assets and packages; verify conformance, focused unit checks, typecheck, changed-file lint, browser/axe/design lint and actual screenshots.
- [x] Compare after screenshots against the captured reference. Update REPORT.md and the review package. Keep staging unchanged.

Constraints: retain theme id/version, merchant-editable settings and existing stores; no staging writes. Generated imagery is illustrative preview content, not merchant catalogue data. Rich mega-menu/wholesale/upsell features remain outside this visual correction.
