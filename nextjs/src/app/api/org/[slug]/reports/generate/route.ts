/**
 * POST /api/org/[slug]/reports/generate
 * 
 * Generates reports for a questionnaire
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { ReportGenerator } from '@/lib/reports/generators/ReportGenerator';
import { GenerateReportRequest, GenerateReportResponse } from '@/lib/reports/types';
import { InsufficientDataError } from '@/lib/reports/core/DataAggregator';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createSSRClient();
    const { slug } = await params;

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get organization by slug
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const orgId = (org as { id: string }).id;

    // Check if user is org admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: isAdmin } = await (supabase as any)
      .rpc('is_org_admin', { org_id: orgId });

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: GenerateReportRequest = await request.json();
    const { questionnaireId, templateId, force = false } = body;

    if (!questionnaireId) {
      return NextResponse.json(
        { error: 'questionnaireId is required' },
        { status: 400 }
      );
    }

    // Verify questionnaire belongs to this organization
    const { data: questionnaire, error: qError } = await supabase
      .from('questionnaires')
      .select('id, organization_id, approach_questionnaire_id')
      .eq('id', questionnaireId)
      .eq('organization_id', orgId)
      .single();

    if (qError || !questionnaire) {
      return NextResponse.json(
        { error: 'Questionnaire not found' },
        { status: 404 }
      );
    }

    const questionnaireData = questionnaire as { id: string; organization_id: string; approach_questionnaire_id: string | null };

    const generator = new ReportGenerator();
    const reports: GenerateReportResponse['reports'] = [];

    if (templateId) {
      // Generate specific template
      try {
        const report = await generator.generate(questionnaireId, templateId, force);
        reports.push({
          id: report.id,
          templateId: report.template_id,
          status: report.status,
          estimatedTime: report.status === 'generating' ? 5 : undefined
        });
      } catch (error) {
        if (error instanceof InsufficientDataError) {
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          );
        }
        throw error;
      }
    } else {
      // Generate all templates for this approach
      if (!questionnaireData.approach_questionnaire_id) {
        return NextResponse.json(
          { error: 'Questionnaire is not associated with an approach' },
          { status: 400 }
        );
      }

      // Get approach from questionnaire template
      const { data: approachQuestionnaire } = await supabase
        .from('approach_questionnaires')
        .select('approach_id')
        .eq('id', questionnaireData.approach_questionnaire_id)
        .single();

      if (!approachQuestionnaire) {
        return NextResponse.json(
          { error: 'Approach not found' },
          { status: 404 }
        );
      }

      const approachData = approachQuestionnaire as { approach_id: string };

      // Get all active report templates for this approach
      const { data: templates, error: templatesError } = await supabase
        .from('approach_report_templates')
        .select('id')
        .eq('approach_id', approachData.approach_id)
        .eq('is_active', true)
        .order('order');

      if (templatesError || !templates || templates.length === 0) {
        return NextResponse.json(
          { error: 'No report templates found for this approach' },
          { status: 404 }
        );
      }

      type TemplateData = { id: string };
      const templatesData = templates as TemplateData[];

      // Generate all templates
      for (const template of templatesData) {
        try {
          const report = await generator.generate(questionnaireId, template.id, force);
          reports.push({
            id: report.id,
            templateId: report.template_id,
            status: report.status,
            estimatedTime: report.status === 'generating' ? 5 : undefined
          });
        } catch (error) {
          // Continue with other templates even if one fails
          console.error(`Failed to generate report for template ${template.id}:`, error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      reports
    } as GenerateReportResponse);

  } catch (error) {
    console.error('Error generating reports:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

