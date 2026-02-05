-- Questionnaire Versioning and Translation System
-- This migration adds:
-- 1. Versioning support for approach questionnaires (draft + publish workflow)
-- 2. Translation support via DeepL API
-- 3. Version pinning for organization questionnaires

-- ============================================================================
-- 1. Add versioning columns to approach_questionnaires
-- ============================================================================

ALTER TABLE approach_questionnaires
ADD COLUMN IF NOT EXISTS master_language text NOT NULL DEFAULT 'en',
ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_draft_changes boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN approach_questionnaires.master_language IS 'Primary language for this questionnaire (en or de). This is the editable master, all other languages are read-only translations.';
COMMENT ON COLUMN approach_questionnaires.current_version IS 'Latest published version number. 0 means no version published yet.';
COMMENT ON COLUMN approach_questionnaires.has_draft_changes IS 'True if the draft schema differs from the last published version.';

-- ============================================================================
-- 2. Create approach_questionnaire_versions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS approach_questionnaire_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approach_questionnaire_id uuid NOT NULL REFERENCES approach_questionnaires(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text NOT NULL,
  description text,
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  master_language text NOT NULL,
  published_by uuid REFERENCES auth.users(id),
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(approach_questionnaire_id, version)
);

CREATE INDEX IF NOT EXISTS idx_approach_questionnaire_versions_questionnaire_id 
ON approach_questionnaire_versions(approach_questionnaire_id);

CREATE INDEX IF NOT EXISTS idx_approach_questionnaire_versions_version 
ON approach_questionnaire_versions(approach_questionnaire_id, version DESC);

COMMENT ON TABLE approach_questionnaire_versions IS 'Immutable published versions of approach questionnaires. Each publish creates a new version snapshot.';
COMMENT ON COLUMN approach_questionnaire_versions.version IS 'Version number (1, 2, 3...). Immutable once created.';
COMMENT ON COLUMN approach_questionnaire_versions.schema IS 'Frozen snapshot of the questionnaire schema at publish time.';

-- ============================================================================
-- 3. Create approach_questionnaire_translations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS approach_questionnaire_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES approach_questionnaire_versions(id) ON DELETE CASCADE,
  language text NOT NULL,
  title text NOT NULL,
  description text,
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  translated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(version_id, language)
);

CREATE INDEX IF NOT EXISTS idx_approach_questionnaire_translations_version_id 
ON approach_questionnaire_translations(version_id);

CREATE INDEX IF NOT EXISTS idx_approach_questionnaire_translations_language 
ON approach_questionnaire_translations(language);

COMMENT ON TABLE approach_questionnaire_translations IS 'DeepL-generated translations for published questionnaire versions. Translations are read-only and tied to specific versions.';
COMMENT ON COLUMN approach_questionnaire_translations.language IS 'Target language code (en, de, etc.)';
COMMENT ON COLUMN approach_questionnaire_translations.schema IS 'Translated questionnaire schema with all text fields translated.';

-- ============================================================================
-- 4. Add version pinning to questionnaires table
-- ============================================================================

ALTER TABLE questionnaires
ADD COLUMN IF NOT EXISTS approach_questionnaire_version_id uuid REFERENCES approach_questionnaire_versions(id);

CREATE INDEX IF NOT EXISTS idx_questionnaires_version_id 
ON questionnaires(approach_questionnaire_version_id);

COMMENT ON COLUMN questionnaires.approach_questionnaire_version_id IS 'Pins this organization questionnaire to a specific published version. Ensures consistency even when the master is updated.';

-- ============================================================================
-- 5. Enable RLS on new tables
-- ============================================================================

ALTER TABLE approach_questionnaire_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approach_questionnaire_translations ENABLE ROW LEVEL SECURITY;

-- RLS policies for approach_questionnaire_versions
-- System admins can view all versions
CREATE POLICY "System admins can view all questionnaire versions"
ON approach_questionnaire_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'system_admin'
  )
);

-- System admins can insert versions (publish action)
CREATE POLICY "System admins can publish questionnaire versions"
ON approach_questionnaire_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'system_admin'
  )
);

-- Org members can view versions for their assigned approaches
CREATE POLICY "Org members can view versions for their approaches"
ON approach_questionnaire_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM approach_questionnaires aq
    JOIN organization_approaches oa ON oa.approach_id = aq.approach_id
    JOIN organization_members om ON om.organization_id = oa.organization_id
    WHERE aq.id = approach_questionnaire_versions.approach_questionnaire_id
    AND om.user_id = auth.uid()
  )
);

-- RLS policies for approach_questionnaire_translations
-- System admins can view all translations
CREATE POLICY "System admins can view all translations"
ON approach_questionnaire_translations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'system_admin'
  )
);

-- System admins can create/update translations
CREATE POLICY "System admins can manage translations"
ON approach_questionnaire_translations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'system_admin'
  )
);

-- Org members can view translations for their assigned approaches
CREATE POLICY "Org members can view translations for their approaches"
ON approach_questionnaire_translations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM approach_questionnaire_versions aqv
    JOIN approach_questionnaires aq ON aq.id = aqv.approach_questionnaire_id
    JOIN organization_approaches oa ON oa.approach_id = aq.approach_id
    JOIN organization_members om ON om.organization_id = oa.organization_id
    WHERE aqv.id = approach_questionnaire_translations.version_id
    AND om.user_id = auth.uid()
  )
);

-- ============================================================================
-- 6. Create trigger to update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_approach_questionnaire_translations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_approach_questionnaire_translations_updated_at
BEFORE UPDATE ON approach_questionnaire_translations
FOR EACH ROW
EXECUTE FUNCTION update_approach_questionnaire_translations_updated_at();

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================

GRANT SELECT ON approach_questionnaire_versions TO anon, authenticated;
GRANT INSERT ON approach_questionnaire_versions TO authenticated;

GRANT SELECT ON approach_questionnaire_translations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON approach_questionnaire_translations TO authenticated;

