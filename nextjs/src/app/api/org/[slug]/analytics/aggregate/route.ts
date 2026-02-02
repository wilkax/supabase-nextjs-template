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

    // Fetch questionnaire with schema
    const { data: questionnaire, error: qError } = await supabase
      .from('questionnaires')
      .select('schema, organization_id, title')
      .eq('id', questionnaireId)
      .single();

    if (qError || !questionnaire) {
      return NextResponse.json(
        { error: 'Questionnaire not found' },
        { status: 404 }
      );
    }

    // Type assertion for questionnaire
    const typedQuestionnaire = questionnaire as Pick<Tables<'questionnaires'>, 'schema' | 'organization_id' | 'title'>;
    const schema = typedQuestionnaire.schema as unknown as QuestionnaireSchema;

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
      // Find question in schema
      let questionInfo = null;
      for (const section of schema.sections) {
        const question = section.questions.find(q => q.id === questionId);
        if (question) {
          questionInfo = { ...question, sectionTitle: section.title };
          break;
        }
      }

      if (!questionInfo) return;

      // Extract values for this question from all responses
      const values: number[] = [];
      typedResponses.forEach(response => {
        const answers = response.answers as Record<string, any>;
        const value = answers[questionId];
        if (value !== null && value !== undefined && typeof value === 'number') {
          values.push(value);
        }
      });

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

      // Calculate statistics
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

