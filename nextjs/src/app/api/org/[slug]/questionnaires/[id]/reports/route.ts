/**
 * GET /api/org/[slug]/questionnaires/[id]/reports
 * 
 * Lists all reports for a specific questionnaire
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { ListReportsResponse, ReportStatus, ReportType } from '@/lib/reports/types';

const MIN_RESPONSES = 5;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const supabase = await createSSRClient();
    const { slug, id: questionnaireId } = await params;

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

    // Check if user is org member
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: isMember } = await (supabase as any)
      .rpc('is_org_member', { org_id: orgId });

    if (!isMember) {
      return NextResponse.json(
        { error: 'Forbidden: Organization membership required' },
        { status: 403 }
      );
    }

    // Fetch questionnaire
    const { data: questionnaire, error: qError } = await supabase
      .from('questionnaires')
      .select('id, title, status, organization_id')
      .eq('id', questionnaireId)
      .eq('organization_id', orgId)
      .single();

    if (qError || !questionnaire) {
      return NextResponse.json(
        { error: 'Questionnaire not found' },
        { status: 404 }
      );
    }

    const questionnaireData = questionnaire as { id: string; title: string; status: string; organization_id: string };

    // Count responses
    const { count: responseCount, error: countError } = await supabase
      .from('questionnaire_responses')
      .select('*', { count: 'exact', head: true })
      .eq('questionnaire_id', questionnaireId);

    if (countError) {
      console.error('Error counting responses:', countError);
    }

    const canGenerate = (responseCount || 0) >= MIN_RESPONSES;

    // Fetch all reports for this questionnaire
    const { data: reports, error: reportsError } = await supabase
      .from('organization_reports')
      .select(`
        id,
        template_id,
        status,
        generated_at,
        template:approach_report_templates(name, type)
      `)
      .eq('questionnaire_id', questionnaireId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (reportsError) {
      console.error('Error fetching reports:', reportsError);
    }

    type ReportData = {
      id: string;
      template_id: string;
      status: ReportStatus;
      generated_at: string | null;
      template: { name: string; type: ReportType };
    };

    // Format response
    const response: ListReportsResponse = {
      questionnaire: {
        id: questionnaireData.id,
        title: questionnaireData.title,
        status: questionnaireData.status
      },
      availableReports: ((reports || []) as ReportData[]).map(report => ({
        id: report.id,
        templateId: report.template_id,
        name: report.template.name,
        type: report.template.type,
        status: report.status,
        generatedAt: report.generated_at || undefined
      })),
      canGenerate,
      minimumResponses: MIN_RESPONSES
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error listing reports:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

