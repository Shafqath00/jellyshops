-- Phase one only. Generated from initial-user.prisma -> schema.prisma, then
-- reviewed for existing rows and extended with PostgreSQL invariants.
BEGIN;

-- CreateEnum
CREATE TYPE "CommerceProvider" AS ENUM ('NATIVE', 'SHOPIFY');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'DESIGNER', 'ORDER_MANAGER', 'STAFF');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firebaseUid" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- Preserve historical users without inventing Firebase links or memberships.
UPDATE "User" SET "updatedAt" = "createdAt";
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "commerceProvider" "CommerceProvider" NOT NULL DEFAULT 'NATIVE',
    "currency" VARCHAR(3) NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "currentPublicationId" TEXT,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreMembership" (
    "storeId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreMembership_pkey" PRIMARY KEY ("storeId","userId")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "storeId" TEXT NOT NULL,
    "contactEmail" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("storeId")
);

-- CreateTable
CREATE TABLE "StoreDomain" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorefrontDraft" (
    "storeId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "document" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorefrontDraft_pkey" PRIMARY KEY ("storeId")
);

-- CreateTable
CREATE TABLE "StorefrontPublication" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sourceRevision" INTEGER NOT NULL,
    "document" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorefrontPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");

-- CreateIndex
CREATE INDEX "StoreMembership_userId_idx" ON "StoreMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreDomain_hostname_key" ON "StoreDomain"("hostname");

-- CreateIndex
CREATE INDEX "StoreDomain_storeId_idx" ON "StoreDomain"("storeId");

-- CreateIndex
CREATE INDEX "StorefrontPublication_storeId_publishedAt_idx" ON "StorefrontPublication"("storeId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StorefrontPublication_storeId_id_key" ON "StorefrontPublication"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_id_currentPublicationId_fkey" FOREIGN KEY ("id", "currentPublicationId") REFERENCES "StorefrontPublication"("storeId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "StoreMembership" ADD CONSTRAINT "StoreMembership_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMembership" ADD CONSTRAINT "StoreMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDomain" ADD CONSTRAINT "StoreDomain_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorefrontDraft" ADD CONSTRAINT "StorefrontDraft_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorefrontPublication" ADD CONSTRAINT "StorefrontPublication_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot represent these CHECK constraints or immutability triggers.
ALTER TABLE "StorefrontDraft"
  ADD CONSTRAINT "StorefrontDraft_revision_check" CHECK ("revision" >= 0),
  ADD CONSTRAINT "StorefrontDraft_document_check" CHECK (jsonb_typeof("document") = 'object');
ALTER TABLE "StorefrontPublication"
  ADD CONSTRAINT "StorefrontPublication_sourceRevision_check" CHECK ("sourceRevision" >= 1),
  ADD CONSTRAINT "StorefrontPublication_document_check" CHECK (jsonb_typeof("document") = 'object');
ALTER TABLE "Store"
  ADD CONSTRAINT "Store_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "Store_country_check" CHECK ("country" ~ '^[A-Z]{2}$');

CREATE FUNCTION jellyshops_reject_publication_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Storefront publications are immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "StorefrontPublication_immutable_rows"
BEFORE UPDATE OR DELETE ON "StorefrontPublication"
FOR EACH ROW EXECUTE FUNCTION jellyshops_reject_publication_mutation();

CREATE TRIGGER "StorefrontPublication_immutable_truncate"
BEFORE TRUNCATE ON "StorefrontPublication"
FOR EACH STATEMENT EXECUTE FUNCTION jellyshops_reject_publication_mutation();

COMMIT;
