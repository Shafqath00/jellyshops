# Execution plan

1. Add serializable setting definitions, manifest validation, settings merging
   and known-setting validation to `packages/storefront-themes`.
2. Declare defaults and controls in the default and Boutique manifests.
3. Expose safe schema metadata from `backend/src/app.ts` and validate saves in
   `ThemeService`.
4. Extend the existing Store Editor API types and add a dynamic theme settings
   inspector to `src/app/admin/online-store/editor/page.tsx`.
5. Apply the resolved configuration to the existing preview and renderer theme
   override selection; retain explicit publishing.
6. Add resolver-focused behaviour tests and update theme documentation.
