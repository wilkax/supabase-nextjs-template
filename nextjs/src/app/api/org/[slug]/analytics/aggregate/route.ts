/**
 * Analytics Data Aggregation API
 * 
 * Aggregates questionnaire response data for selected questions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { StatisticalCalculator } from '@/lib/reports/core/StatisticalCalculator';
import { Tables } from '@/lib/types';

interface AggregateRequest {
  questionnaireId: string;
  questionIds: string[];
}

interface QuestionnaireSchema {
  sections: Array<{
    id: string;
    title: string;
    questions: Array<{
      id: string;
      text: string;
      type: string;
      scale?: {
        min: number;
        max: number;
        minLabel: string;
        maxLabel: string;
      };
      options?: string[];
      maxLength?: number;
    }>;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json() as AggregateRequest;
    const { questionnaireId, questionIds } = body;

    if (!questionnaireId || !questionIds || questionIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Fetch questionnaire with schema and version info
    const { data: questionnaire, error: qError } = await supabase
      .from('questionnaires')
      .select('schema, organization_id, title, approach_questionnaire_version_id')
      .eq('id', questionnaireId)
      .single();

    if (qError || !questionnaire) {
      return NextResponse.json(
        { error: 'Questionnaire not found' },
        { status: 404 }
      );
    }

    // Type assertion for questionnaire
    const typedQuestionnaire = questionnaire as Pick<Tables<'questionnaires'>, 'schema' | 'organization_id' | 'title'> & {
      approach_questionnaire_version_id: string | null;
    };
    const schema = typedQuestionnaire.schema as unknown as QuestionnaireSchema;

    // Fetch master language schema if version is available
    let masterSchema: QuestionnaireSchema | null = null;
    let masterLanguage = 'en';
    let allTranslations: Record<string, QuestionnaireSchema> = {};

    if (typedQuestionnaire.approach_questionnaire_version_id) {
      const { data: versionData } = await supabase
        .from('approach_questionnaire_versions')
        .select('schema, master_language')
        .eq('id', typedQuestionnaire.approach_questionnaire_version_id)
        .single();

      if (versionData) {
        const typedVersionData = versionData as { schema: any; master_language: string };
        masterSchema = typedVersionData.schema as unknown as QuestionnaireSchema;
        masterLanguage = typedVersionData.master_language || 'en';
        allTranslations[masterLanguage] = masterSchema;

        // Fetch all translations for this version
        const { data: translationsData } = await supabase
          .from('approach_questionnaire_translations')
          .select('language, schema')
          .eq('version_id', typedQuestionnaire.approach_questionnaire_version_id);

        if (translationsData && translationsData.length > 0) {
          translationsData.forEach((translation: any) => {
            allTranslations[translation.language] = translation.schema as unknown as QuestionnaireSchema;
          });
        }
      }
    }

    // Use master schema if available, otherwise fall back to questionnaire schema
    const schemaForAnalysis = masterSchema || schema;

    // Fetch all responses for this questionnaire
    const { data: responses, error: rError } = await supabase
      .from('questionnaire_responses')
      .select('*')
      .eq('questionnaire_id', questionnaireId);

    if (rError) {
      return NextResponse.json(
        { error: 'Failed to fetch responses' },
        { status: 500 }
      );
    }

    // Type assertion for responses
    const typedResponses = (responses || []) as Tables<'questionnaire_responses'>[];

    if (typedResponses.length === 0) {
      return NextResponse.json({
        questions: {},
        responseCount: 0,
        message: 'No responses available'
      });
    }

    // Aggregate data for each selected question
    const aggregatedQuestions: Record<string, any> = {};

    questionIds.forEach(questionId => {
      // Find question in master schema (for option labels)
      let questionInfo = null;
      for (const section of schemaForAnalysis.sections) {
        const question = section.questions.find(q => q.id === questionId);
        if (question) {
          questionInfo = { ...question, sectionTitle: section.title };
          break;
        }
      }

      if (!questionInfo) return;

      // Extract values for this question from all responses
      const rawValues: any[] = [];
      typedResponses.forEach(response => {
        const answers = response.answers as Record<string, any>;
        const value = answers[questionId];
        if (value !== null && value !== undefined) {
          rawValues.push(value);
        }
      });

      // Type-specific aggregation
      const questionType = questionInfo.type;

      if (questionType === 'scale') {
        // Scale questions: numeric values
        const values: number[] = rawValues.filter(v => typeof v === 'number');

        if (values.length === 0) {
          aggregatedQuestions[questionId] = {
            questionText: questionInfo.text,
            sectionTitle: questionInfo.sectionTitle,
            type: questionInfo.type,
            scale: questionInfo.scale,
            responseCount: 0,
            average: 0,
            distribution: {}
          };
          return;
        }

        const average = StatisticalCalculator.average(values);
        const distribution = StatisticalCalculator.distribution(values);
        const median = StatisticalCalculator.median(values);
        const { min, max } = StatisticalCalculator.range(values);

        aggregatedQuestions[questionId] = {
          questionText: questionInfo.text,
          sectionTitle: questionInfo.sectionTitle,
          type: questionInfo.type,
          scale: questionInfo.scale,
          responseCount: values.length,
          average: Math.round(average * 100) / 100,
          median: Math.round(median * 100) / 100,
          min,
          max,
          distribution
        };
      } else if (questionType === 'single-choice') {
        // Extract master language options
        let masterOptions: string[] = [];
        if (questionInfo.options) {
          if (Array.isArray(questionInfo.options)) {
            masterOptions = questionInfo.options;
          } else if (typeof questionInfo.options === 'object') {
            const optionsObj = questionInfo.options as Record<string, string[]>;
            masterOptions = optionsObj[masterLanguage] || optionsObj.en || optionsObj.de || Object.values(optionsObj)[0] || [];
          }
        }

        // Convert all responses to master language labels
        const labelValues: string[] = [];
        rawValues.forEach(value => {
          if (typeof value === 'number') {
            // New format: index
            if (value >= 0 && value < masterOptions.length) {
              labelValues.push(masterOptions[value]);
            }
          } else if (typeof value === 'string') {
            // Old format: text - try to match against all translations
            let matched = false;

            // First try exact match in master language
            const masterIdx = masterOptions.indexOf(value);
            if (masterIdx >= 0) {
              labelValues.push(masterOptions[masterIdx]);
              matched = true;
            } else {
              // Try to find in other translations
              for (const [lang, translatedSchema] of Object.entries(allTranslations)) {
                if (matched) break;
                for (const section of translatedSchema.sections) {
                  const q = section.questions.find(q => q.id === questionId);
                  if (q && q.options) {
                    const opts = Array.isArray(q.options) ? q.options :
                      (typeof q.options === 'object' ? (q.options as any)[lang] || [] : []);
                    const idx = opts.indexOf(value);
                    if (idx >= 0 && idx < masterOptions.length) {
                      labelValues.push(masterOptions[idx]);
                      matched = true;
                      break;
                    }
                  }
                }
              }
            }

            // If still not matched, use the original text (fallback)
            if (!matched) {
              labelValues.push(value);
            }
          }
        });

        const distribution = StatisticalCalculator.distribution(labelValues);
        const mode = StatisticalCalculator.mode(labelValues);

        aggregatedQuestions[questionId] = {
          questionText: questionInfo.text,
          sectionTitle: questionInfo.sectionTitle,
          type: questionInfo.type,
          options: masterOptions,
          responseCount: labelValues.length,
          distribution,
          topAnswer: mode
        };
      } else if (questionType === 'multiple-choice') {
        // Extract master language options
        let masterOptions: string[] = [];
        if (questionInfo.options) {
          if (Array.isArray(questionInfo.options)) {
            masterOptions = questionInfo.options;
          } else if (typeof questionInfo.options === 'object') {
            const optionsObj = questionInfo.options as Record<string, string[]>;
            masterOptions = optionsObj[masterLanguage] || optionsObj.en || optionsObj.de || Object.values(optionsObj)[0] || [];
          }
        }

        // Convert all selections to master language labels
        const labelSelections: string[] = [];
        rawValues.forEach(value => {
          if (Array.isArray(value)) {
            value.forEach(item => {
              if (typeof item === 'number') {
                // New format: index
                if (item >= 0 && item < masterOptions.length) {
                  labelSelections.push(masterOptions[item]);
                }
              } else if (typeof item === 'string') {
                // Old format: text - try to match
                let matched = false;

                const masterIdx = masterOptions.indexOf(item);
                if (masterIdx >= 0) {
                  labelSelections.push(masterOptions[masterIdx]);
                  matched = true;
                } else {
                  // Try other translations
                  for (const [lang, translatedSchema] of Object.entries(allTranslations)) {
                    if (matched) break;
                    for (const section of translatedSchema.sections) {
                      const q = section.questions.find(q => q.id === questionId);
                      if (q && q.options) {
                        const opts = Array.isArray(q.options) ? q.options :
                          (typeof q.options === 'object' ? (q.options as any)[lang] || [] : []);
                        const idx = opts.indexOf(item);
                        if (idx >= 0 && idx < masterOptions.length) {
                          labelSelections.push(masterOptions[idx]);
                          matched = true;
                          break;
                        }
                      }
                    }
                  }
                }

                if (!matched) {
                  labelSelections.push(item);
                }
              }
            });
          }
        });

        const distribution = StatisticalCalculator.distribution(labelSelections);

        aggregatedQuestions[questionId] = {
          questionText: questionInfo.text,
          sectionTitle: questionInfo.sectionTitle,
          type: questionInfo.type,
          options: masterOptions,
          responseCount: rawValues.length,
          totalSelections: labelSelections.length,
          distribution
        };
      } else if (questionType === 'ranking') {
        // Extract master language options
        let masterOptions: string[] = [];
        if (questionInfo.options) {
          if (Array.isArray(questionInfo.options)) {
            masterOptions = questionInfo.options;
          } else if (typeof questionInfo.options === 'object') {
            const optionsObj = questionInfo.options as Record<string, string[]>;
            masterOptions = optionsObj[masterLanguage] || optionsObj.en || optionsObj.de || Object.values(optionsObj)[0] || [];
          }
        }

        const rankSums: Record<string, number> = {};
        const rankCounts: Record<string, number> = {};

        // Initialize all options
        masterOptions.forEach(option => {
          rankSums[option] = 0;
          rankCounts[option] = 0;
        });

        rawValues.forEach(value => {
          if (Array.isArray(value)) {
            value.forEach((item, position) => {
              let label: string | null = null;

              if (typeof item === 'number') {
                // New format: index
                if (item >= 0 && item < masterOptions.length) {
                  label = masterOptions[item];
                }
              } else if (typeof item === 'string') {
                // Old format: text - try to match
                let matched = false;

                const masterIdx = masterOptions.indexOf(item);
                if (masterIdx >= 0) {
                  label = masterOptions[masterIdx];
                  matched = true;
                } else {
                  // Try other translations
                  for (const [lang, translatedSchema] of Object.entries(allTranslations)) {
                    if (matched) break;
                    for (const section of translatedSchema.sections) {
                      const q = section.questions.find(q => q.id === questionId);
                      if (q && q.options) {
                        const opts = Array.isArray(q.options) ? q.options :
                          (typeof q.options === 'object' ? (q.options as any)[lang] || [] : []);
                        const idx = opts.indexOf(item);
                        if (idx >= 0 && idx < masterOptions.length) {
                          label = masterOptions[idx];
                          matched = true;
                          break;
                        }
                      }
                    }
                  }
                }

                if (!matched) {
                  label = item;
                }
              }

              if (label) {
                rankSums[label] = (rankSums[label] || 0) + (position + 1); // rank starts at 1
                rankCounts[label] = (rankCounts[label] || 0) + 1;
              }
            });
          }
        });

        // Calculate average rank for each option
        const averageRanks: Record<string, number> = {};
        Object.keys(rankSums).forEach(option => {
          if (rankCounts[option] > 0) {
            averageRanks[option] = Math.round((rankSums[option] / rankCounts[option]) * 100) / 100;
          }
        });

        aggregatedQuestions[questionId] = {
          questionText: questionInfo.text,
          sectionTitle: questionInfo.sectionTitle,
          type: questionInfo.type,
          options: masterOptions,
          responseCount: rawValues.length,
          averageRanks,
          rankCounts
        };
      } else if (questionType === 'free-text') {
        // Free text: collect all text responses
        const textResponses: string[] = rawValues.filter(v => typeof v === 'string' && v.trim() !== '');

        aggregatedQuestions[questionId] = {
          questionText: questionInfo.text,
          sectionTitle: questionInfo.sectionTitle,
          type: questionInfo.type,
          maxLength: questionInfo.maxLength,
          responseCount: textResponses.length,
          responses: textResponses
        };
      } else {
        // Unknown type - return basic info
        aggregatedQuestions[questionId] = {
          questionText: questionInfo.text,
          sectionTitle: questionInfo.sectionTitle,
          type: questionInfo.type,
          responseCount: rawValues.length
        };
      }
    });

    return NextResponse.json({
      questions: aggregatedQuestions,
      responseCount: typedResponses.length,
      questionnaireTitle: typedQuestionnaire.title
    });

  } catch (error) {
    console.error('Analytics aggregation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

