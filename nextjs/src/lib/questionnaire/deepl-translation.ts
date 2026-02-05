/**
 * DeepL Translation Service for Questionnaires
 * 
 * This service handles translation of questionnaire schemas using the DeepL API.
 * It walks through the schema JSON structure and translates all text fields while
 * preserving the structure and non-text fields.
 */

export type SupportedLanguage = 'en' | 'de';

interface DeepLTranslationRequest {
  text: string[];
  target_lang: string;
  source_lang?: string;
}

interface DeepLTranslationResponse {
  translations: Array<{
    detected_source_language: string;
    text: string;
  }>;
}

/**
 * Translate text using DeepL API
 */
async function translateWithDeepL(
  texts: string[],
  targetLang: SupportedLanguage,
  sourceLang?: SupportedLanguage
): Promise<string[]> {
  const apiKey = process.env.DEEPL_API_KEY;
  
  if (!apiKey) {
    throw new Error('DEEPL_API_KEY environment variable is not set');
  }

  // DeepL API expects uppercase language codes
  const targetLangCode = targetLang.toUpperCase();
  const sourceLangCode = sourceLang?.toUpperCase();

  const requestBody: DeepLTranslationRequest = {
    text: texts,
    target_lang: targetLangCode,
  };

  if (sourceLangCode) {
    requestBody.source_lang = sourceLangCode;
  }

  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepL API error: ${response.status} - ${errorText}`);
  }

  const data: DeepLTranslationResponse = await response.json();
  return data.translations.map(t => t.text);
}

/**
 * Extract all translatable text from a questionnaire schema
 * Returns an array of text strings and their paths in the schema
 */
function extractTranslatableTexts(schema: any): Array<{ path: string; text: string }> {
  const texts: Array<{ path: string; text: string }> = [];

  if (!schema || !schema.sections) {
    return texts;
  }

  schema.sections.forEach((section: any, sectionIndex: number) => {
    // Section title
    if (section.title) {
      texts.push({
        path: `sections[${sectionIndex}].title`,
        text: section.title,
      });
    }

    // Section description
    if (section.description) {
      texts.push({
        path: `sections[${sectionIndex}].description`,
        text: section.description,
      });
    }

    // Questions
    if (section.questions) {
      section.questions.forEach((question: any, questionIndex: number) => {
        // Question text
        if (question.text) {
          texts.push({
            path: `sections[${sectionIndex}].questions[${questionIndex}].text`,
            text: question.text,
          });
        }

        // Scale labels
        if (question.scale) {
          if (question.scale.minLabel) {
            texts.push({
              path: `sections[${sectionIndex}].questions[${questionIndex}].scale.minLabel`,
              text: question.scale.minLabel,
            });
          }
          if (question.scale.maxLabel) {
            texts.push({
              path: `sections[${sectionIndex}].questions[${questionIndex}].scale.maxLabel`,
              text: question.scale.maxLabel,
            });
          }
        }

        // Options (for choice-based questions)
        if (question.options && Array.isArray(question.options)) {
          question.options.forEach((option: string, optionIndex: number) => {
            texts.push({
              path: `sections[${sectionIndex}].questions[${questionIndex}].options[${optionIndex}]`,
              text: option,
            });
          });
        }
      });
    }
  });

  return texts;
}

/**
 * Apply translations back to the schema
 */
function applyTranslations(
  schema: any,
  translations: Array<{ path: string; text: string }>
): any {
  const translatedSchema = JSON.parse(JSON.stringify(schema)); // Deep clone

  translations.forEach(({ path, text }) => {
    const parts = path.split(/[\.\[\]]/).filter(Boolean);
    let current: any = translatedSchema;

    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = text;
  });

  return translatedSchema;
}

/**
 * Translate an entire questionnaire schema
 *
 * @param schema - The questionnaire schema to translate
 * @param title - The questionnaire title to translate
 * @param description - The questionnaire description to translate (optional)
 * @param targetLang - Target language (en or de)
 * @param sourceLang - Source language (en or de, optional - DeepL will auto-detect)
 * @returns Translated schema, title, and description
 */
export async function translateQuestionnaireSchema(
  schema: any,
  title: string,
  description: string | null,
  targetLang: SupportedLanguage,
  sourceLang?: SupportedLanguage
): Promise<{
  schema: any;
  title: string;
  description: string | null;
}> {
  // Extract all translatable texts from schema
  const schemaTexts = extractTranslatableTexts(schema);

  // Prepare all texts for translation (title, description, and schema texts)
  const allTexts: string[] = [title];
  const textMap: Array<{ type: 'title' | 'description' | 'schema'; index?: number }> = [
    { type: 'title' },
  ];

  if (description) {
    allTexts.push(description);
    textMap.push({ type: 'description' });
  }

  schemaTexts.forEach((item, index) => {
    allTexts.push(item.text);
    textMap.push({ type: 'schema', index });
  });

  // Translate all texts in a single API call (more efficient)
  const translatedTexts = await translateWithDeepL(allTexts, targetLang, sourceLang);

  // Map translations back
  let translatedTitle = '';
  let translatedDescription: string | null = null;
  const translatedSchemaTexts: Array<{ path: string; text: string }> = [];

  translatedTexts.forEach((text, index) => {
    const mapping = textMap[index];
    if (mapping.type === 'title') {
      translatedTitle = text;
    } else if (mapping.type === 'description') {
      translatedDescription = text;
    } else if (mapping.type === 'schema' && mapping.index !== undefined) {
      translatedSchemaTexts.push({
        path: schemaTexts[mapping.index].path,
        text,
      });
    }
  });

  // Apply translations to schema
  const translatedSchema = applyTranslations(schema, translatedSchemaTexts);

  return {
    schema: translatedSchema,
    title: translatedTitle,
    description: translatedDescription,
  };
}

