/**
 * Reports List Page
 * 
 * Lists all available reports for a questionnaire
 */

import { createSSRClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

interface PageProps {
  params: Promise<{
    slug: string;
    id: string;
  }>;
}

export default async function ReportsListPage({ params }: PageProps) {
  const { slug, id: questionnaireId } = await params;
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

  // Fetch questionnaire
  const { data: questionnaire, error: qError } = await supabase
    .from('questionnaires')
    .select('id, title, status, organization_id')
    .eq('id', questionnaireId)
    .eq('organization_id', orgId)
    .single();

  if (qError || !questionnaire) {
    notFound();
  }

  const questionnaireData = questionnaire as { id: string; title: string; status: string; organization_id: string };

  // Count responses
  const { count: responseCount } = await supabase
    .from('questionnaire_responses')
    .select('*', { count: 'exact', head: true })
    .eq('questionnaire_id', questionnaireId);

  const canGenerate = (responseCount || 0) >= 5;

  // Fetch all reports
  const { data: reports } = await supabase
    .from('organization_reports')
    .select(`
      id,
      template_id,
      status,
      generated_at,
      response_count,
      template:approach_report_templates(name, type, description)
    `)
    .eq('questionnaire_id', questionnaireId)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  type ReportData = {
    id: string;
    template_id: string;
    status: string;
    generated_at: string | null;
    response_count: number;
    template: { name: string; type: string; description?: string };
  };

  const reportsData = (reports || []) as ReportData[];

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
          {questionnaireData.title}
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Reports</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports</h1>
        <p className="text-gray-600">
          View and generate reports for {questionnaireData.title}
        </p>
      </div>

      {/* Response count info */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">
              Total Responses: {responseCount || 0}
            </p>
            {!canGenerate && (
              <p className="text-sm text-blue-700 mt-1">
                At least 5 responses are required to generate reports
              </p>
            )}
          </div>
          {canGenerate && (
            <button
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
              onClick={() => {
                // TODO: Implement generate all reports
                alert('Generate reports functionality to be implemented');
              }}
            >
              Generate All Reports
            </button>
          )}
        </div>
      </div>

      {/* Reports list */}
      {reportsData.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reportsData.map((report) => (
            <Link
              key={report.id}
              href={`/app/org/${slug}/questionnaires/${questionnaireId}/reports/${report.id}`}
              className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {report.template.name}
                </h3>
                <span
                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    report.status === 'ready'
                      ? 'bg-green-100 text-green-800'
                      : report.status === 'generating'
                      ? 'bg-blue-100 text-blue-800'
                      : report.status === 'error'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {report.status}
                </span>
              </div>
              
              {report.template.description && (
                <p className="text-sm text-gray-600 mb-3">
                  {report.template.description}
                </p>
              )}
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="capitalize">{report.template.type}</span>
                {report.generated_at && (
                  <span>
                    {new Date(report.generated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No reports generated yet</p>
          {canGenerate && (
            <button
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
              onClick={() => {
                // TODO: Implement generate reports
                alert('Generate reports functionality to be implemented');
              }}
            >
              Generate Reports
            </button>
          )}
        </div>
      )}
    </div>
  );
}

