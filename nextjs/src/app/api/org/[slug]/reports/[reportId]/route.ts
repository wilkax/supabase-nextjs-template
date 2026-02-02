/**
 * GET /api/org/[slug]/reports/[reportId]
 * 
 * Retrieves a specific report with all its data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { GetReportResponse, ReportType, ReportTemplateConfig, ComputedReportData, ReportStatus } from '@/lib/reports/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; reportId: string }> }
) {
  try {
    const supabase = await createSSRClient();
    const { slug, reportId } = await params;

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

    // Fetch report with related data
    const { data: report, error: reportError } = await supabase
      .from('organization_reports')
      .select(`
        *,
        template:approach_report_templates(id, name, type, config),
        questionnaire:questionnaires(id, title, status)
      `)
      .eq('id', reportId)
      .eq('organization_id', orgId)
      .single();

    if (reportError || !report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    type ReportData = {
      id: string;
      status: ReportStatus;
      computed_data: ComputedReportData;
      generated_at: string | null;
      response_count: number;
      template: { id: string; name: string; type: ReportType; config: ReportTemplateConfig };
      questionnaire: { id: string; title: string; status: string };
    };

    const reportData = report as ReportData;

    // Format response
    const response: GetReportResponse = {
      id: reportData.id,
      template: {
        id: reportData.template.id,
        name: reportData.template.name,
        type: reportData.template.type,
        config: reportData.template.config
      },
      questionnaire: {
        id: reportData.questionnaire.id,
        title: reportData.questionnaire.title,
        status: reportData.questionnaire.status
      },
      status: reportData.status,
      computedData: reportData.computed_data,
      metadata: {
        generatedAt: reportData.generated_at || undefined,
        responseCount: reportData.response_count,
        completionRate: reportData.computed_data?.completion_rate as number | undefined
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

