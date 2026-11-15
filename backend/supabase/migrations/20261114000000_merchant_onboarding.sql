ALTER TABLE "StoreSettings"
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '' CHECK (char_length("description") <= 500),
  ADD COLUMN "category" TEXT NOT NULL DEFAULT '' CHECK (char_length("category") <= 100),
  ADD COLUMN "businessType" TEXT NOT NULL DEFAULT '' CHECK (char_length("businessType") <= 100);

CREATE TABLE "MerchantOnboarding" (
  "userId" UUID PRIMARY KEY,
  "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
  "step" TEXT NOT NULL DEFAULT 'profile' CHECK ("step" IN ('profile','store','branding','business','products','review')),
  "answers" JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof("answers") = 'object'),
  "completedStoreId" TEXT,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "MerchantPolicyAcceptance" (
  "userId" UUID NOT NULL,
  "version" TEXT NOT NULL CHECK (char_length("version") BETWEEN 1 AND 100),
  "acceptedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("userId", "version")
);

CREATE TABLE "MerchantProfile" (
  "userId" UUID PRIMARY KEY,
  "fullName" TEXT NOT NULL CHECK (char_length("fullName") BETWEEN 1 AND 120),
  "bio" TEXT NOT NULL DEFAULT '' CHECK (char_length("bio") <= 500)
);

CREATE TABLE "MerchantOnboardingImage" (
  "userId" UUID NOT NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('profile', 'logo')),
  "contents" BYTEA NOT NULL CHECK (octet_length("contents") BETWEEN 1 AND 2097152),
  PRIMARY KEY ("userId", "kind")
);

-- Express derives the owning UUID from the verified session. Browsers use no direct table grants.
DO $isolate$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['MerchantOnboarding','MerchantPolicyAcceptance','MerchantProfile','MerchantOnboardingImage']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', table_name);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO jelly_backend', table_name);
      EXECUTE format('CREATE POLICY backend_access ON public.%I TO jelly_backend USING (true) WITH CHECK (true)', table_name);
    END IF;
  END LOOP;
END
$isolate$;
