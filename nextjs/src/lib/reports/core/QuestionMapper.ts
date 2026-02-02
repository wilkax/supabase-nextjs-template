/**
 * QuestionMapper - Maps questionnaire questions to report data points
 * 
 * This utility takes questionnaire responses and maps them according to
 * the data mappings defined in the report template configuration.
 */

import {
  DataMapping,
  QuestionResponse,
  IQuestionMapper,
  QuestionnaireSchema,
  RawResponse,
  DataFilters,
  ResponseValue
} from '../types';

export class QuestionMapper implements IQuestionMapper {
  /**
   * Maps questions to data points based on template configuration
   *
   * @param questionnaireSchema - The questionnaire schema with sections and questions
   * @param responses - Array of participant responses
   * @param dataMappings - Configuration mapping questions to report dimensions
   * @returns Mapped question responses grouped by dimension
   */
  mapQuestionsToData(
    questionnaireSchema: QuestionnaireSchema,
    responses: RawResponse[],
    dataMappings: Record<string, DataMapping>
  ): Record<string, QuestionResponse[]> {
    const mappedData: Record<string, QuestionResponse[]> = {};

    // Initialize empty arrays for each dimension
    Object.keys(dataMappings).forEach(dimensionKey => {
      mappedData[dimensionKey] = [];
    });

    // Process each response
    responses.forEach(response => {
      const participantId = response.participant_id as string;
      const answers = (response.answers || {}) as Record<string, unknown>;

      // For each dimension in the data mappings
      Object.entries(dataMappings).forEach(([dimensionKey, mapping]) => {
        // Extract responses for the questions in this dimension
        mapping.questionIds.forEach(questionId => {
          const value = this.extractQuestionValue(answers, questionId);

          if (value !== null && value !== undefined) {
            // Apply filters if specified
            if (this.passesFilters(response, mapping.filters)) {
              mappedData[dimensionKey].push({
                questionId,
                value,
                participantId
              });
            }
          }
        });
      });
    });

    return mappedData;
  }

  /**
   * Extracts the value for a specific question from the answers object
   *
   * @param answers - The answers object from a response
   * @param questionId - The ID of the question to extract
   * @returns The answer value or null if not found
   */
  private extractQuestionValue(answers: Record<string, unknown>, questionId: string): ResponseValue | null {
    // Handle both flat and nested answer structures
    if (answers[questionId] !== undefined) {
      return answers[questionId] as ResponseValue;
    }

    // Check if answers are nested by section
    for (const key in answers) {
      if (typeof answers[key] === 'object' && answers[key] !== null) {
        const nested = answers[key] as Record<string, unknown>;
        if (nested[questionId] !== undefined) {
          return nested[questionId] as ResponseValue;
        }
      }
    }

    return null;
  }

  /**
   * Checks if a response passes the specified filters
   *
   * @param response - The response object
   * @param filters - Optional filters to apply
   * @returns True if response passes all filters
   */
  private passesFilters(
    response: RawResponse,
    filters?: DataFilters
  ): boolean {
    if (!filters || Object.keys(filters).length === 0) {
      return true;
    }

    // Check each filter condition
    for (const [key, expectedValue] of Object.entries(filters)) {
      const actualValue = this.getNestedValue(response, key);

      if (Array.isArray(expectedValue)) {
        // If expected value is an array, check if actual value is in the array
        if (!(expectedValue as unknown[]).includes(actualValue)) {
          return false;
        }
      } else {
        // Direct equality check
        if (actualValue !== expectedValue) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Gets a nested value from an object using dot notation
   *
   * @param obj - The object to search
   * @param path - The path to the value (e.g., "metadata.role")
   * @returns The value at the path or undefined
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Validates that all required questions exist in the questionnaire schema
   *
   * @param questionnaireSchema - The questionnaire schema
   * @param dataMappings - The data mappings to validate
   * @returns Validation result with any missing question IDs
   */
  validateMappings(
    questionnaireSchema: QuestionnaireSchema,
    dataMappings: Record<string, DataMapping>
  ): { valid: boolean; missingQuestions: string[] } {
    const allQuestionIds = this.extractAllQuestionIds(questionnaireSchema);
    const missingQuestions: string[] = [];

    Object.values(dataMappings).forEach(mapping => {
      mapping.questionIds.forEach(questionId => {
        if (!allQuestionIds.includes(questionId)) {
          missingQuestions.push(questionId);
        }
      });
    });

    return {
      valid: missingQuestions.length === 0,
      missingQuestions
    };
  }

  /**
   * Extracts all question IDs from a questionnaire schema
   *
   * @param schema - The questionnaire schema
   * @returns Array of all question IDs
   */
  private extractAllQuestionIds(schema: QuestionnaireSchema): string[] {
    const questionIds: string[] = [];

    if (schema.sections && Array.isArray(schema.sections)) {
      (schema.sections as Array<Record<string, unknown>>).forEach((section) => {
        if (section.questions && Array.isArray(section.questions)) {
          (section.questions as Array<Record<string, unknown>>).forEach((question) => {
            if (question.id && typeof question.id === 'string') {
              questionIds.push(question.id);
            }
          });
        }
      });
    }

    return questionIds;
  }
}

