-- Organization Management Features Migration
-- This migration adds:
-- 1. Archive functionality for organizations
-- 2. Category as array of labels for approaches
-- 3. Allows multiple questionnaires per approach

-- ============================================================================
-- 1. Add is_archived to organizations table
-- ============================================================================

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Create index for faster filtering of archived organizations
CREATE INDEX IF NOT EXISTS idx_organizations_is_archived 
ON organizations(is_archived);

-- Add comment
COMMENT ON COLUMN organizations.is_archived IS 'Whether the organization is archived (soft delete)';

-- ============================================================================
-- 2. Change approaches.category from text to text[] (array of labels)
-- ============================================================================

-- Migrate existing category values to array format
-- NULL stays NULL, single text value becomes single-element array
ALTER TABLE approaches 
ALTER COLUMN category TYPE text[] USING 
  CASE 
    WHEN category IS NULL THEN NULL 
    ELSE ARRAY[category] 
  END;

-- Add comment
COMMENT ON COLUMN approaches.category IS 'Array of category labels for this approach';

-- ============================================================================
-- 3. Allow multiple questionnaires per approach
-- ============================================================================

-- Drop the unique constraint on approach_id to allow multiple questionnaires per approach
ALTER TABLE approach_questionnaires
DROP CONSTRAINT IF EXISTS approach_questionnaires_approach_id_key;

-- Add comment
COMMENT ON TABLE approach_questionnaires IS 'Questionnaire templates for approaches. Multiple questionnaires can be created per approach.';

-- ============================================================================
-- 4. Update RLS policies for archived organizations (optional enhancement)
-- ============================================================================

-- Note: Existing RLS policies will continue to work
-- Archived organizations are still accessible but can be filtered in queries
-- If you want to hide archived orgs by default, you can update policies here

-- Example: Update organization viewing policy to exclude archived by default
-- (Commented out - you may want to keep archived orgs visible to admins)
-- DROP POLICY IF EXISTS "Users can view organizations they are members of" ON organizations;
-- CREATE POLICY "Users can view organizations they are members of"
-- ON organizations
-- FOR SELECT
-- USING (
--   is_archived = false AND (
--     id IN (
--       SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
--     )
--     OR EXISTS (
--       SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'system_admin'
--     )
--   )
-- );

-- ============================================================================
-- Grant permissions
-- ============================================================================

-- No new tables created, so no new grants needed
-- Existing permissions on organizations and approaches tables remain unchanged

