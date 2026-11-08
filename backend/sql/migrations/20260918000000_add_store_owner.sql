BEGIN;

-- Supabase Auth user ID. This is the sole authorization source for stores;
-- StoreMembership remains only as a transitional compatibility table.
ALTER TABLE "Store" ADD COLUMN "owner_user_id" UUID;

-- Existing stores deliberately remain unassigned: there is no safe way to
-- infer a Supabase owner from seed or historical rows. Before enabling
-- AUTH_PROVIDER=supabase in production, explicitly backfill every live store
-- from a reviewed owner mapping, then enforce NOT NULL in a follow-up release.

-- Add index for efficient querying by owner
CREATE INDEX "Store_owner_user_id_idx" ON "Store"("owner_user_id");

COMMIT;
