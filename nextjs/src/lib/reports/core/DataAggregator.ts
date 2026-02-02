/**
 * DataAggregator - Aggregates questionnaire responses into computed report data
 * 
 * This service orchestrates the aggregation of questionnaire responses
 * according to the report template configuration.
 */

import { createSSRClient } from '@/lib/supabase/server';
import {
  IDataAggregator,
  ReportTemplateConfig,
  ComputedReportData,
  DimensionData,
  AggregationType,
  AggregationFunction,
  AggregationContext,
  QuestionnaireSchema,
  RawResponse
} from '../types';
import { QuestionMapper } from './QuestionMapper';
import { StatisticalCalculator } from './StatisticalCalculator';

export class InsufficientDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientDataError';
  }
}

export class DataAggregator implements IDataAggregator {
  private static readonly MIN_RESPONSES = 5;
  private questionMapper: QuestionMapper;
  private customAggregators: Map<string, AggregationFunction>;

  constructor() {
    this.questionMapper = new QuestionMapper();
    this.customAggregators = new Map();
  }

  /**
   * Registers a custom aggregation function
   */
  registerCustomAggregator(name: string, fn: AggregationFunction): void {
    this.customAggregators.set(name, fn);
  }

  /**
   * Main aggregation method
   */
  async aggregate(
    questionnaireId: string,
    config: ReportTemplateConfig
  ): Promise<ComputedReportData> {
    const supabase = await createSSRClient();

    // Fetch questionnaire schema
    const { data: questionnaire, error: qError } = await supabase
      .from('questionnaires')
      .select('schema, organization_id')
      .eq('id', questionnaireId)
      .single();

    if (qError || !questionnaire) {
      throw new Error(`Failed to fetch questionnaire: ${qError?.message}`);
    }

    const questionnaireData = questionnaire as { schema: QuestionnaireSchema };

    // Fetch all responses
    const { data: responses, error: rError } = await supabase
      .from('questionnaire_responses')
      .select('*')
      .eq('questionnaire_id', questionnaireId);

    if (rError) {
      throw new Error(`Failed to fetch responses: ${rError.message}`);
    }

    // Check minimum response threshold
    if (!responses || responses.length < DataAggregator.MIN_RESPONSES) {
      throw new InsufficientDataError(
        `Need at least ${DataAggregator.MIN_RESPONSES} responses, got ${responses?.length || 0}`
      );
    }

    // Validate mappings
    const validation = this.questionMapper.validateMappings(
      questionnaireData.schema,
      config.dataMappings
    );

    if (!validation.valid) {
      throw new Error(
        `Invalid data mappings. Missing questions: ${validation.missingQuestions.join(', ')}`
      );
    }

    // Map questions to data points
    const mappedData = this.questionMapper.mapQuestionsToData(
      questionnaireData.schema,
      responses,
      config.dataMappings
    );

    // Aggregate each dimension
    const dimensions: Record<string, DimensionData> = {};

    for (const [dimensionKey, mapping] of Object.entries(config.dataMappings)) {
      const questionResponses = mappedData[dimensionKey];
      
      const context: AggregationContext = {
        questionIds: mapping.questionIds,
        responses: questionResponses,
        scale: mapping.scale,
        weights: mapping.weights,
        filters: mapping.filters
      };

      dimensions[dimensionKey] = this.aggregateDimension(
        context,
        mapping.aggregationType,
        mapping.customAggregator
      );
    }

    // Calculate overall metrics
    const overallScore = this.calculateOverallScore(dimensions);
    const completionRate = this.calculateCompletionRate(responses, questionnaireData.schema);

    return {
      dimensions,
      overall_score: overallScore,
      response_count: responses.length,
      completion_rate: completionRate,
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Aggregates data for a single dimension
   */
  private aggregateDimension(
    context: AggregationContext,
    aggregationType: AggregationType,
    customAggregatorName?: string
  ): DimensionData {
    // Use custom aggregator if specified
    if (customAggregatorName && this.customAggregators.has(customAggregatorName)) {
      const customFn = this.customAggregators.get(customAggregatorName)!;
      return customFn(context);
    }

    // Extract numeric values
    const values = context.responses.map(r => {
      const val = typeof r.value === 'number' ? r.value : parseFloat(String(r.value));
      return isNaN(val) ? 0 : val;
    });

    let aggregatedValue: number;
    let distribution: Record<string, number> | undefined;

    switch (aggregationType) {
      case 'average':
        aggregatedValue = StatisticalCalculator.average(values);
        break;
      case 'sum':
        aggregatedValue = StatisticalCalculator.sum(values);
        break;
      case 'count':
        aggregatedValue = StatisticalCalculator.count(values);
        break;
      case 'median':
        aggregatedValue = StatisticalCalculator.median(values);
        break;
      case 'mode':
        const mode = StatisticalCalculator.mode(values);
        aggregatedValue = typeof mode === 'number' ? mode : parseFloat(String(mode)) || 0;
        break;
      case 'distribution':
      case 'percentage':
        distribution = aggregationType === 'percentage'
          ? StatisticalCalculator.percentage(context.responses.map(r => r.value))
          : StatisticalCalculator.distribution(context.responses.map(r => r.value));
        aggregatedValue = StatisticalCalculator.average(values);
        break;
      default:
        aggregatedValue = StatisticalCalculator.average(values);
    }

    return {
      value: aggregatedValue,
      responses: context.responses.length,
      distribution
    };
  }

  /**
   * Calculates overall score across all dimensions
   */
  private calculateOverallScore(dimensions: Record<string, DimensionData>): number {
    const values = Object.values(dimensions).map(d => d.value);
    return values.length > 0 ? StatisticalCalculator.average(values) : 0;
  }

  /**
   * Calculates completion rate based on responses
   */
  private calculateCompletionRate(responses: RawResponse[], schema: QuestionnaireSchema): number {
    if (!responses || responses.length === 0) return 0;

    const totalQuestions = this.countTotalQuestions(schema);
    if (totalQuestions === 0) return 0;

    let totalAnswered = 0;
    responses.forEach(response => {
      const answeredCount = this.countAnsweredQuestions(response.answers as Record<string, unknown>);
      totalAnswered += answeredCount;
    });

    const totalPossible = responses.length * totalQuestions;
    return totalPossible > 0 ? totalAnswered / totalPossible : 0;
  }

  /**
   * Counts total questions in schema
   */
  private countTotalQuestions(schema: QuestionnaireSchema): number {
    let count = 0;
    if (schema.sections && Array.isArray(schema.sections)) {
      (schema.sections as Array<Record<string, unknown>>).forEach((section) => {
        if (section.questions && Array.isArray(section.questions)) {
          count += section.questions.length;
        }
      });
    }
    return count;
  }

  /**
   * Counts answered questions in a response
   */
  private countAnsweredQuestions(answers: Record<string, unknown>): number {
    if (!answers || typeof answers !== 'object') return 0;

    let count = 0;
    const countValues = (obj: Record<string, unknown>) => {
      Object.values(obj).forEach(value => {
        if (value !== null && value !== undefined && value !== '') {
          if (typeof value === 'object' && !Array.isArray(value)) {
            countValues(value as Record<string, unknown>);
          } else {
            count++;
          }
        }
      });
    };

    countValues(answers);
    return count;
  }
}
