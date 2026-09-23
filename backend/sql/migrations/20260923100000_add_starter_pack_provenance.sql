ALTER TABLE "StorefrontWorkspace"
  ADD COLUMN IF NOT EXISTS "starterPackId" TEXT,
  ADD COLUMN IF NOT EXISTS "starterPackVersion" TEXT;
