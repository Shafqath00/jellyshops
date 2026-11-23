-- More shop addresses nobody may choose (system names), added with billing step 4b
-- (docs/plans/2026-11-23-phase-4-billing-and-limits.md): the paused-shop page and the staging photo address.
-- The list in jellyshops/packages/storefront-schema/src/store-address.ts is the source; a backend test keeps every
-- *_reserved_slugs*.sql seed equal to it. Additive only.
INSERT INTO "ReservedSlug" ("slug", "reason") VALUES
  ('img-staging', 'system'),
  ('shop-paused', 'system')
ON CONFLICT ("slug") DO NOTHING;
