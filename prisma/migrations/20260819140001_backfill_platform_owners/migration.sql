-- Keep owner@autovault360.com as the main platform owner.
-- Any other active platform_owner accounts become secondary owners.
UPDATE "users"
SET "role" = 'platform_secondary_owner'
WHERE "role" = 'platform_owner'
  AND "deletedAt" IS NULL
  AND lower("email") <> 'owner@autovault360.com';
