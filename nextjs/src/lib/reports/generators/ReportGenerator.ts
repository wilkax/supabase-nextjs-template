/**
 * ReportGenerator - Main service for generating reports
 * 
 * This service orchestrates the entire report generation process,
 * from fetching data to storing computed results.
 */

import { createSSRClient } from '@/lib/supabase/server';
import {
  IReportGenerator,
  OrganizationReport,
  ReportTemplateConfig,
  ReportStatus
} from '../types';
import { DataAggregator } from '../core/DataAggregator';

export class ReportGenerator implements IReportGenerator {
  private aggregator: DataAggregator;

  constructor() {
    this.aggregator = new DataAggregator();
  }

  /**
   * Generates a report for a questionnaire using a specific template
   */
  async generate(
    questionnaireId: string,
    templateId: string,
    force: boolean = false
  ): Promise<OrganizationReport> {
    const supabase = await createSSRClient();

    // Fetch questionnaire to get organization_id
    const { data: questionnaire, error: qError } = await supabase
      .from('questionnaires')
      .select('organization_id, approach_questionnaire_id')
      .eq('id', questionnaireId)
      .single();

    if (qError || !questionnaire) {
      throw new Error(`Failed to fetch questionnaire: ${qError?.message}`);
    }

    const questionnaireData = questionnaire as { organization_id: string; approach_questionnaire_id: string | null };

    // Fetch report template
    const { data: template, error: tError } = await supabase
      .from('approach_report_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (tError || !template) {
      throw new Error(`Failed to fetch report template: ${tError?.message}`);
    }

    const templateData = template as { config: ReportTemplateConfig };

    // Check if report already exists
    const { data: existingReport } = await supabase
      .from('organization_reports')
      .select('*')
      .eq('organization_id', questionnaireData.organization_id)
      .eq('template_id', templateId)
      .eq('questionnaire_id', questionnaireId)
      .single();

    if (existingReport && !force) {
      // Return existing report if not forcing regeneration
      return existingReport as OrganizationReport;
    }

    // Create or update report record with 'generating' status
    const reportData = {
      organization_id: questionnaireData.organization_id,
      template_id: templateId,
      questionnaire_id: questionnaireId,
      status: 'generating' as ReportStatus,
      computed_data: {},
      response_count: 0
    };

    let reportId: string;

    if (existingReport) {
      // Update existing report
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('organization_reports')
        .update(reportData)
        .eq('id', (existingReport as { id: string }).id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update report: ${updateError.message}`);
      }
      reportId = (existingReport as { id: string }).id;
    } else {
      // Create new report
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: created, error: createError } = await (supabase as any)
        .from('organization_reports')
        .insert(reportData)
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create report: ${createError.message}`);
      }
      reportId = created.id;
    }

    try {
      // Aggregate data
      const config = templateData.config;
      const computedData = await this.aggregator.aggregate(questionnaireId, config);

      // Update report with computed data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: finalReport, error: finalError } = await (supabase as any)
        .from('organization_reports')
        .update({
          status: 'ready' as ReportStatus,
          computed_data: computedData,
          generated_at: new Date().toISOString(),
          response_count: computedData.response_count,
          error_message: null
        })
        .eq('id', reportId)
        .select()
        .single();

      if (finalError) {
        throw new Error(`Failed to save computed data: ${finalError.message}`);
      }

      return finalReport as OrganizationReport;

    } catch (error) {
      // Update report with error status
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('organization_reports')
        .update({
          status: 'error' as ReportStatus,
          error_message: errorMessage
        })
        .eq('id', reportId);

      throw error;
    }
  }

  /**
   * Gets a report by ID
   */
  async getReport(reportId: string): Promise<OrganizationReport | null> {
    const supabase = await createSSRClient();

    const { data, error } = await supabase
      .from('organization_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error) {
      return null;
    }

    return data as OrganizationReport;
  }

  /**
   * Lists all reports for a questionnaire
   */
  async listReports(questionnaireId: string): Promise<OrganizationReport[]> {
    const supabase = await createSSRClient();

    const { data, error } = await supabase
      .from('organization_reports')
      .select('*')
      .eq('questionnaire_id', questionnaireId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list reports: ${error.message}`);
    }

    return (data || []) as OrganizationReport[];
  }
}

