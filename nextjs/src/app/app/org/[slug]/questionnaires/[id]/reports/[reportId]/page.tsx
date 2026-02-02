/**
 * Report View Page
 * 
 * Displays a specific report for a questionnaire
 */

import { createSSRClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { ReportViewer } from '@/components/reports/ReportViewer';
import { ComputedReportData, ReportTemplateConfig } from '@/lib/reports/types';
import Link from 'next/link';

interface PageProps {
  params: Promise<{
    slug: string;
    id: string;
    reportId: string;
  }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { slug, id: questionnaireId, reportId } = await params;
  const supabase = await createSSRClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/auth/login');
  }

  // Get organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', slug)
    .single();

  if (orgError || !org) {
    notFound();
  }

  const orgId = (org as { id: string; name: string }).id;
  const orgName = (org as { id: string; name: string }).name;

  // Check if user is org member
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isMember } = await (supabase as any)
    .rpc('is_org_member', { org_id: orgId });

  if (!isMember) {
    redirect('/app');
  }

  // Fetch report with related data
  const { data: report, error: reportError } = await supabase
    .from('organization_reports')
    .select(`
      *,
      template:approach_report_templates(id, name, type, config, description),
      questionnaire:questionnaires(id, title, status)
    `)
    .eq('id', reportId)
    .eq('organization_id', orgId)
    .eq('questionnaire_id', questionnaireId)
    .single();

  if (reportError || !report) {
    notFound();
  }

  type ReportData = {
    template: {
      name: string;
      type: 'visualization' | 'pdf' | 'dashboard';
      description?: string;
      config: Record<string, unknown>;
    };
    questionnaire: { title: string };
    status: 'pending' | 'generating' | 'ready' | 'error';
    computed_data: Record<string, unknown>;
    error_message?: string | null;
  };

  const reportData = report as ReportData;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center space-x-2 text-sm text-gray-600">
        <Link href={`/app/org/${slug}`} className="hover:text-gray-900">
          {orgName}
        </Link>
        <span>/</span>
        <Link
          href={`/app/org/${slug}/questionnaires/${questionnaireId}`}
          className="hover:text-gray-900"
        >
          {reportData.questionnaire.title}
        </Link>
        <span>/</span>
        <Link
          href={`/app/org/${slug}/questionnaires/${questionnaireId}/reports`}
          className="hover:text-gray-900"
        >
          Reports
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{reportData.template.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {reportData.template.name}
            </h1>
            {reportData.template.description && (
              <p className="text-gray-600 max-w-3xl">
                {reportData.template.description}
              </p>
            )}
          </div>
          
          <Link
            href={`/app/org/${slug}/questionnaires/${questionnaireId}/reports`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Back to Reports
          </Link>
        </div>

        {/* Status badge */}
        <div className="mt-4">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              reportData.status === 'ready'
                ? 'bg-green-100 text-green-800'
                : reportData.status === 'generating'
                ? 'bg-blue-100 text-blue-800'
                : reportData.status === 'error'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {reportData.status.charAt(0).toUpperCase() + reportData.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Report Viewer */}
      <ReportViewer
        reportType={reportData.template.type}
        status={reportData.status}
        computedData={reportData.computed_data as ComputedReportData}
        config={reportData.template.config as unknown as ReportTemplateConfig}
        className="mb-8"
      />

      {/* Error message if any */}
      {reportData.error_message && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <h3 className="text-sm font-medium text-red-800 mb-1">Error Details</h3>
          <p className="text-sm text-red-700">{reportData.error_message}</p>
        </div>
      )}
    </div>
  );
}

