-- Create enum for report status
CREATE TYPE report_status AS ENUM ('pending', 'generating', 'ready', 'error');

-- Create organization_reports table
CREATE TABLE organization_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES approach_report_templates(id) ON DELETE CASCADE,
  questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  status report_status NOT NULL DEFAULT 'pending',
  computed_data JSONB DEFAULT '{}'::jsonb,
  config_override JSONB DEFAULT '{}'::jsonb,
  generated_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  response_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one report per organization/template/questionnaire combination
  CONSTRAINT unique_org_template_questionnaire UNIQUE (organization_id, template_id, questionnaire_id)
);

-- Create indexes for performance
CREATE INDEX idx_organization_reports_org_id ON organization_reports(organization_id);
CREATE INDEX idx_organization_reports_template_id ON organization_reports(template_id);
CREATE INDEX idx_organization_reports_questionnaire_id ON organization_reports(questionnaire_id);
CREATE INDEX idx_organization_reports_status ON organization_reports(status);
CREATE INDEX idx_organization_reports_generated_at ON organization_reports(generated_at DESC);

-- Create composite index for common query pattern
CREATE INDEX idx_organization_reports_org_questionnaire ON organization_reports(organization_id, questionnaire_id);

-- Enable Row Level Security
ALTER TABLE organization_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view reports for organizations they are members of
CREATE POLICY "Users can view organization reports"
  ON organization_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_reports.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- RLS Policy: Org admins can insert reports
CREATE POLICY "Org admins can create reports"
  ON organization_reports
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_reports.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'admin'
    )
  );

-- RLS Policy: Org admins can update reports
CREATE POLICY "Org admins can update reports"
  ON organization_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_reports.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'admin'
    )
  );

-- RLS Policy: Org admins can delete reports
CREATE POLICY "Org admins can delete reports"
  ON organization_reports
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_reports.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'admin'
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_organization_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before update
CREATE TRIGGER trigger_update_organization_reports_updated_at
  BEFORE UPDATE ON organization_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_reports_updated_at();

-- Add comment to table
COMMENT ON TABLE organization_reports IS 'Stores generated reports with computed/aggregated data for questionnaires';
COMMENT ON COLUMN organization_reports.computed_data IS 'Aggregated and processed data ready for visualization (JSONB)';
COMMENT ON COLUMN organization_reports.config_override IS 'Optional configuration overrides for this specific report instance';
COMMENT ON COLUMN organization_reports.response_count IS 'Number of responses used to generate this report';

