# Theme-owned storefront shell plan

1. Add serializable shell view-model props and component resolver helpers to
   `packages/storefront-themes`.
2. Add Boutique layout/header/footer/cart presentation components and register
   them without theme checks in shared code.
3. Split `StorefrontFrame` into shared state assembly and a theme-resolved
   shell; make `CartPanel` accept a presentation wrapper while retaining all
   cart calculations, mutations and checkout links in core.
4. Load the immutable public publication theme into the frame and use the same
   shell in the existing Theme Editor preview.
5. Add resolver/shell tests, document the contract, and run focused checks.
