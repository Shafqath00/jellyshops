-- Section groups (theme plan T6): the shared sections drawn above every page (header group), below it (footer
-- group) and on top of it (overlay group), as ordered lists of "GlobalSection" ids:
--   { "header": ["…"], "footer": ["…"], "overlay": ["…"] }
-- NULL means the store has not saved groups yet: the header and footer then come from each template's own shared
-- sections, exactly as before. Groups are saved the first time a merchant edits one in the editor; the live store
-- changes only when the merchant publishes. "StorefrontWorkspace" already has RLS and the backend-only policy.
ALTER TABLE "StorefrontWorkspace" ADD COLUMN IF NOT EXISTS "sectionGroups" JSONB;
ALTER TABLE "StorefrontWorkspace" DROP CONSTRAINT IF EXISTS "StorefrontWorkspace_sectionGroups_check";
ALTER TABLE "StorefrontWorkspace" ADD CONSTRAINT "StorefrontWorkspace_sectionGroups_check" CHECK ("sectionGroups" IS NULL OR jsonb_typeof("sectionGroups") = 'object');
