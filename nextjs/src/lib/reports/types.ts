/**
 * Reporting System - Core Type Definitions
 * 
 * This file contains all TypeScript types and interfaces for the reporting system.
 */

import { ReactNode } from 'react';

// ============================================================================
// Generic Configuration Types
// ============================================================================

// Generic type for configuration options - allows nested objects
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ConfigOptions = Record<string, any>;

// Filter value types
export type FilterValue = string | number | boolean | string[] | number[];
export type DataFilters = Record<string, FilterValue>;

// ============================================================================
// Report Status and Types
// ============================================================================

export type ReportStatus = 'pending' | 'generating' | 'ready' | 'error';
export type ReportType = 'visualization' | 'pdf' | 'dashboard';

// ============================================================================
// Aggregation Types
// ============================================================================

export type AggregationType = 
  | 'average'
  | 'sum'
  | 'count'
  | 'distribution'
  | 'percentage'
  | 'median'
  | 'mode'
  | 'custom';

// ============================================================================
// Visualization Types
// ============================================================================

export type VisualizationType = 
  | 'bar'
  | 'line'
  | 'pie'
  | 'radar'
  | 'flower'  // Laloux Flower custom visualization
  | 'custom';

// ============================================================================
// Data Mapping Configuration
// ============================================================================

export interface DataMapping {
  questionIds: string[];
  aggregationType: AggregationType;
  scale?: {
    min: number;
    max: number;
  };
  weights?: Record<string, number>;
  filters?: DataFilters;
  customAggregator?: string; // Name of registered custom aggregation function
}

export interface VisualizationConfig {
  type: VisualizationType;
  dimensions: string[];
  options: ConfigOptions;
}

export interface DashboardWidget {
  type: 'metric' | 'chart' | 'table';
  position: {
    row: number;
    col: number;
    span: number;
  };
  dataSource: string;
  options: ConfigOptions;
}

export interface DashboardConfig {
  layout: 'grid' | 'flex';
  widgets: DashboardWidget[];
}

// ============================================================================
// Report Template Configuration
// ============================================================================

export interface ReportTemplateConfig {
  dataMappings: Record<string, DataMapping>;
  visualization?: VisualizationConfig;
  dashboard?: DashboardConfig;
  pdf?: {
    template: string;
    options: ConfigOptions;
  };
}

// ============================================================================
// Computed Data Structures
// ============================================================================

export interface QuestionAggregateData {
  value: number;
  responses: number;
  distribution?: Record<string, number>;
}

export interface DimensionData {
  value: number;
  responses: number;
  distribution?: Record<string, number>;
  questions?: Record<string, QuestionAggregateData>;
}

export interface ComputedReportData {
  dimensions?: Record<string, DimensionData>;
  metrics?: Record<string, number | string>;
  overall_score?: number;
  response_count: number;
  completion_rate?: number;
  generated_at: string;
  // Allow custom fields for approach-specific data
  [key: string]: DimensionData | Record<string, DimensionData> | Record<string, number | string> | number | string | undefined;
}

// ============================================================================
// Database Models
// ============================================================================

export interface OrganizationReport {
  id: string;
  organization_id: string;
  template_id: string;
  questionnaire_id: string;
  status: ReportStatus;
  computed_data: ComputedReportData;
  config_override?: ReportTemplateConfig;
  generated_at?: string;
  error_message?: string;
  response_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReportTemplate {
  id: string;
  approach_id: string;
  name: string;
  slug: string;
  description?: string;
  type: ReportType;
  config: ReportTemplateConfig;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Renderer Interfaces
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ReportRenderer {
  type: ReportType;
  render(data: ComputedReportData, config: ReportTemplateConfig): ReactNode;
  validate(config: ReportTemplateConfig): ValidationResult;
  export?(format: 'pdf' | 'png' | 'csv'): Promise<Blob>;
}

// ============================================================================
// Aggregation Function Types
// ============================================================================

// Response value can be various types depending on question type
export type ResponseValue = string | number | boolean | string[] | number[] | Record<string, unknown>;

export interface QuestionResponse {
  questionId: string;
  value: ResponseValue;
  participantId: string;
}

export interface AggregationContext {
  questionIds: string[];
  responses: QuestionResponse[];
  scale?: { min: number; max: number };
  weights?: Record<string, number>;
  filters?: DataFilters;
}

export type AggregationFunction = (context: AggregationContext) => DimensionData;

export interface AggregatorRegistry {
  register(name: string, fn: AggregationFunction): void;
  get(name: string): AggregationFunction | undefined;
  has(name: string): boolean;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface GenerateReportRequest {
  questionnaireId: string;
  templateId?: string; // Optional: generate specific template, or all if omitted
  force?: boolean; // Force regeneration even if exists
}

export interface GenerateReportResponse {
  success: boolean;
  reports: Array<{
    id: string;
    templateId: string;
    status: ReportStatus;
    estimatedTime?: number; // seconds
  }>;
}

export interface GetReportResponse {
  id: string;
  template: {
    id: string;
    name: string;
    type: ReportType;
    config: ReportTemplateConfig;
  };
  questionnaire: {
    id: string;
    title: string;
    status: string;
  };
  status: ReportStatus;
  computedData: ComputedReportData;
  metadata: {
    generatedAt?: string;
    responseCount: number;
    completionRate?: number;
  };
}

export interface ListReportsResponse {
  questionnaire: {
    id: string;
    title: string;
    status: string;
  };
  availableReports: Array<{
    id: string;
    templateId: string;
    name: string;
    type: ReportType;
    status: ReportStatus;
    generatedAt?: string;
  }>;
  canGenerate: boolean;
  minimumResponses: number;
}

// ============================================================================
// Service Interfaces
// ============================================================================

export interface IDataAggregator {
  aggregate(
    questionnaireId: string,
    config: ReportTemplateConfig
  ): Promise<ComputedReportData>;
}

// Questionnaire schema type - flexible structure for different questionnaire formats
export type QuestionnaireSchema = Record<string, unknown>;
export type RawResponse = Record<string, unknown>;

export interface IQuestionMapper {
  mapQuestionsToData(
    questionnaireSchema: QuestionnaireSchema,
    responses: RawResponse[],
    dataMappings: Record<string, DataMapping>
  ): Record<string, QuestionResponse[]>;
}

export interface IReportGenerator {
  generate(
    questionnaireId: string,
    templateId: string,
    force?: boolean
  ): Promise<OrganizationReport>;

  getReport(reportId: string): Promise<OrganizationReport | null>;

  listReports(questionnaireId: string): Promise<OrganizationReport[]>;
}

