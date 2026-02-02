/**
 * Interactive Analytics Dashboard
 * 
 * Dynamic filtering and visualization with PowerPoint export
 */

import { createSSRClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { AnalyticsDashboardClient } from '@/components/analytics/AnalyticsDashboardClient';
import { Tables } from '@/lib/types';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function AnalyticsPage({ params }: PageProps) {
  const { slug } = await params;
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

  const orgData = org as { id: string; name: string };

  // Fetch all questionnaires for this organization with their schemas
  const { data: questionnaires } = await supabase
    .from('questionnaires')
    .select(`
      id,
      title,
      status,
      schema,
      approach_questionnaire_id,
      created_at
    `)
    .eq('organization_id', orgData.id)
    .order('created_at', { ascending: false });

  // Fetch approaches for filtering
  const { data: approaches } = await supabase
    .from('approaches')
    .select('id, name, slug')
    .order('name');

  // Type assertion for questionnaires
  type QuestionnaireWithSchema = Pick<Tables<'questionnaires'>, 'id' | 'title' | 'status' | 'schema' | 'created_at'> & {
    approach_questionnaire_id: string | null;
  };
  const typedQuestionnaires = (questionnaires || []) as QuestionnaireWithSchema[];

  // For each questionnaire, get response count
  const questionnairesWithStats = await Promise.all(
    typedQuestionnaires.map(async (q) => {
      const { count: responseCount } = await supabase
        .from('questionnaire_responses')
        .select('*', { count: 'exact', head: true })
        .eq('questionnaire_id', q.id);

      return {
        ...q,
        responseCount: responseCount || 0,
      };
    })
  );

  return (
    <AnalyticsDashboardClient
      organization={orgData}
      questionnaires={questionnairesWithStats}
      approaches={approaches || []}
      slug={slug}
    />
  );
}
