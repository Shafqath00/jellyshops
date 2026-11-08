-- Developer tokens: long-lived, revocable keys a store owner creates for `jelly-theme upload` and
-- `install`, instead of copying a short-lived sign-in token.
--
-- Only a SHA-256 hash of the token is stored; the token itself is shown once when it is created.
-- A token belongs to one store and only works on that store's theme package routes (scope
-- 'themes'). Revoked or expired tokens stop working at once; rows are kept for the audit trail.
CREATE TABLE IF NOT EXISTS "DeveloperToken" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY['themes']::TEXT[],
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lastUsedAt" TIMESTAMPTZ,
  "expiresAt" TIMESTAMPTZ,
  "revokedAt" TIMESTAMPTZ,
  CONSTRAINT "DeveloperToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeveloperToken_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeveloperToken_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 80),
  CONSTRAINT "DeveloperToken_tokenHash_check" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "DeveloperToken_prefix_check" CHECK ("prefix" ~ '^jdt_[A-Za-z0-9_-]{4,8}$'),
  CONSTRAINT "DeveloperToken_scopes_check" CHECK ("scopes" <@ ARRAY['themes']::TEXT[] AND cardinality("scopes") >= 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeveloperToken_tokenHash_key" ON "DeveloperToken" ("tokenHash");
CREATE INDEX IF NOT EXISTS "DeveloperToken_storeId_idx" ON "DeveloperToken" ("storeId");

-- Server-only, like the other store tables: row level security on, only the backend role may read or write.
ALTER TABLE public."DeveloperToken" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."DeveloperToken" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."DeveloperToken" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."DeveloperToken" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."DeveloperToken" TO jelly_backend;
    CREATE POLICY backend_access ON public."DeveloperToken" TO jelly_backend USING (true) WITH CHECK (true);
  END IF;
END
$isolate$;
