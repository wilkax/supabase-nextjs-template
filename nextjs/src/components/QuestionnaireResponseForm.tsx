'use client'

import { useState, useEffect, useRef } from 'react'
import { Tables } from '@/lib/types'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { submitParticipantResponse } from '@/app/[locale]/actions/participant-responses'

type SupportedLanguage = 'en' | 'de'

type Questionnaire = Tables<'questionnaires'>
type Participant = Tables<'participants'>
type QuestionnaireResponse = Tables<'questionnaire_responses'>

interface Question {
  id: string
  text: string
  type: 'scale' | 'single-choice' | 'multiple-choice' | 'ranking' | 'free-text'
  required?: boolean
  scale?: {
    min: number
    max: number
    minLabel: string
    maxLabel: string
  }
  options?: string[]
  maxLength?: number
}

interface Section {
  id: string
  title: string
  description?: string
  questions: Question[]
}

interface QuestionnaireSchema {
  sections: Section[]
}

interface Answers {
  [questionId: string]: number | string | number[] | string[] | undefined
}

interface Props {
  questionnaire: Questionnaire
  participant: Participant
  existingResponse: QuestionnaireResponse | null
  isWithinTimeFrame?: boolean
  masterLanguage?: string
  translations?: Record<string, { title: string; description: string | null; schema: any }>
}

export default function QuestionnaireResponseForm({
  questionnaire,
  participant,
  existingResponse,
  isWithinTimeFrame = true,
  masterLanguage = 'en',
  translations = {}
}: Props) {
  const t = useTranslations('questionnaire')
  const tErrors = useTranslations('errors')
  const [answers, setAnswers] = useState<Answers>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(!!existingResponse)
  const [error, setError] = useState<string | null>(null)
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(masterLanguage as SupportedLanguage)
  const [languageSelected, setLanguageSelected] = useState(false)
  const [hasStartedAnswering, setHasStartedAnswering] = useState(false)
  const questionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // Check if questionnaire is in draft mode
  const isQuestionnaireActive = questionnaire.status === 'active'

  // Determine which schema to use based on current language and translations
  let schema: QuestionnaireSchema = { sections: [] }
  let questionnaireTitle = questionnaire.title
  let questionnaireDescription = questionnaire.description

  // Use translations system
  const translationData = translations[currentLanguage]
  if (translationData) {
    questionnaireTitle = translationData.title
    questionnaireDescription = translationData.description
    const schemaData = translationData.schema
    if (
      schemaData &&
      typeof schemaData === 'object' &&
      !Array.isArray(schemaData) &&
      'sections' in schemaData &&
      Array.isArray(schemaData.sections)
    ) {
      schema = schemaData as unknown as QuestionnaireSchema
    }
  }

  // Check if multiple languages are available
  const availableLanguages = Object.keys(translations)
  const hasMultipleLanguages = availableLanguages.length > 1

  useEffect(() => {
    if (existingResponse && existingResponse.answers) {
      // Convert old text-based responses to index-based for backward compatibility
      const rawAnswers = existingResponse.answers as unknown as Answers
      const convertedAnswers: Answers = {}

      Object.keys(rawAnswers).forEach(questionId => {
        const value = rawAnswers[questionId]

        // Find the question in the schema
        let question: Question | null = null
        for (const section of schema.sections) {
          const found = section.questions.find(q => q.id === questionId)
          if (found) {
            question = found
            break
          }
        }

        if (!question) {
          // Question not found in schema, keep as-is
          convertedAnswers[questionId] = value
          return
        }

        // Convert based on question type
        if (question.type === 'single-choice' && typeof value === 'string' && question.options) {
          // Old format: text string → convert to index
          const index = question.options.indexOf(value)
          convertedAnswers[questionId] = index >= 0 ? index : value // fallback to original if not found
        } else if (question.type === 'multiple-choice' && Array.isArray(value) && question.options) {
          // Old format: string[] → convert to number[]
          const allStrings = value.every(v => typeof v === 'string')
          if (allStrings) {
            const indices = (value as string[]).map(text => {
              const idx = question!.options!.indexOf(text)
              return idx >= 0 ? idx : text // fallback to original if not found
            }).filter(v => typeof v === 'number') as number[]
            convertedAnswers[questionId] = indices.length > 0 ? indices : value
          } else {
            convertedAnswers[questionId] = value // already indices
          }
        } else if (question.type === 'ranking' && Array.isArray(value) && question.options) {
          // Old format: string[] → convert to number[]
          const allStrings = value.every(v => typeof v === 'string')
          if (allStrings) {
            const indices = (value as string[]).map(text => {
              const idx = question!.options!.indexOf(text)
              return idx >= 0 ? idx : -1
            }).filter(v => v >= 0) as number[]
            convertedAnswers[questionId] = indices.length > 0 ? indices : value
          } else {
            convertedAnswers[questionId] = value // already indices
          }
        } else {
          // Scale, free-text, or already in correct format
          convertedAnswers[questionId] = value
        }
      })

      setAnswers(convertedAnswers)
      setHasStartedAnswering(true)
    }
    // If only one language available, skip language selection
    if (!hasMultipleLanguages) {
      setLanguageSelected(true)
    }
  }, [existingResponse, hasMultipleLanguages, schema])



  function scrollToNextQuestion(currentQuestionId: string) {
    // Get all question IDs in order
    const allQuestionIds: string[] = []
    schema.sections.forEach(section => {
      section.questions.forEach(q => allQuestionIds.push(q.id))
    })

    // Find current question index
    const currentIndex = allQuestionIds.indexOf(currentQuestionId)

    // If there's a next question, scroll to it
    if (currentIndex >= 0 && currentIndex < allQuestionIds.length - 1) {
      const nextQuestionId = allQuestionIds[currentIndex + 1]
      const nextElement = questionRefs.current[nextQuestionId]

      if (nextElement) {
        setTimeout(() => {
          nextElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 150)
      }
    }
  }

  function handleAnswerChange(questionId: string, value: number | string | number[]) {
    setHasStartedAnswering(true)
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }))
    scrollToNextQuestion(questionId)
  }

  function handleMultipleChoiceChange(questionId: string, optionIndex: number, checked: boolean) {
    setHasStartedAnswering(true)
    setAnswers(prev => {
      const current = (prev[questionId] as number[]) || []
      if (checked) {
        return { ...prev, [questionId]: [...current, optionIndex] }
      } else {
        return { ...prev, [questionId]: current.filter(idx => idx !== optionIndex) }
      }
    })
  }

  function handleRankingChange(questionId: string, indices: number[]) {
    setHasStartedAnswering(true)
    setAnswers(prev => ({
      ...prev,
      [questionId]: indices
    }))
  }

  function validateAnswers(): boolean {
    for (const section of schema.sections) {
      for (const question of section.questions) {
        if (question.required !== false) {
          const answer = answers[question.id]
          if (answer === undefined || answer === null || answer === '' || 
              (Array.isArray(answer) && answer.length === 0)) {
            setError(`Please answer: ${question.text}`)
            return false
          }
        }
      }
    }
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!validateAnswers()) {
      return
    }

    setSubmitting(true)

    // Use server action to submit response (bypasses RLS for anonymous participants)
    const result = await submitParticipantResponse(
      questionnaire.id,
      participant.id,
      answers,
      existingResponse?.id
    )

    if (!result.success) {
      setError(result.error || tErrors('failedToSubmit'))
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    setSubmitted(true)
  }

  // Language selection screen (only if multiple languages available)
  if (!languageSelected && hasMultipleLanguages) {
    const languageNames: Record<string, string> = {
      en: 'English',
      de: 'Deutsch',
    }

    return (
      <div className="bg-white shadow rounded-lg p-8">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {currentLanguage === 'de' ? 'Sprache wählen' : 'Select Language'}
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            {currentLanguage === 'de'
              ? 'Bitte wählen Sie Ihre bevorzugte Sprache für diesen Fragebogen. Die Sprache kann nach dem Start nicht mehr geändert werden.'
              : 'Please select your preferred language for this questionnaire. The language cannot be changed after you start.'}
          </p>
          <div className="space-y-3">
            {availableLanguages.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  setCurrentLanguage(lang as SupportedLanguage)
                  setLanguageSelected(true)
                }}
                className="w-full px-6 py-4 text-left border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-between group"
              >
                <span className="text-base font-medium text-gray-900 group-hover:text-blue-700">
                  {languageNames[lang] || lang.toUpperCase()}
                </span>
                <svg className="h-5 w-5 text-gray-400 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="bg-white shadow rounded-lg p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-3" />
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          {existingResponse ? t('updateResponse') + '!' : t('thankYou')}
        </h2>
        <p className="text-sm text-gray-600">
          {existingResponse
            ? t('responseUpdatedSuccess')
            : t('responseSubmittedSuccess')}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {schema.sections.map((section, sectionIndex) => (
        <div key={section.id} className="bg-white shadow rounded-lg p-4">
          <h3 className="text-base font-medium text-gray-900 mb-1">
            {section.title}
          </h3>
          {section.description && (
            <p className="text-xs text-gray-600 mb-3">{section.description}</p>
          )}

          <div className="space-y-4">
            {section.questions.map((question, questionIndex) => (
              <div
                key={question.id}
                ref={el => { questionRefs.current[question.id] = el }}
                className="border-l-2 border-blue-500 pl-3 py-1"
              >
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  {sectionIndex + 1}.{questionIndex + 1} {question.text}
                  {question.required !== false && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>

                {/* Scale Question */}
                {question.type === 'scale' && question.scale && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{question.scale.minLabel}</span>
                      <span>{question.scale.maxLabel}</span>
                    </div>
                    <div className="flex gap-1.5 justify-between">
                      {Array.from(
                        { length: question.scale.max - question.scale.min + 1 },
                        (_, i) => question.scale!.min + i
                      ).map((value) => (
                        <label
                          key={value}
                          className={`flex-1 flex flex-col items-center gap-1 p-2 border-2 rounded-md cursor-pointer transition-colors ${
                            answers[question.id] === value
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name={question.id}
                            value={value}
                            checked={answers[question.id] === value}
                            onChange={(e) => handleAnswerChange(question.id, parseInt(e.target.value))}
                            className="sr-only"
                          />
                          <span className="text-sm font-medium">{value}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Single Choice Question */}
                {question.type === 'single-choice' && question.options && (
                  <div className="space-y-1.5">
                    {question.options.map((option, idx) => (
                      <label
                        key={idx}
                        className={`flex items-center gap-2 p-2 border rounded-md cursor-pointer transition-colors ${
                          answers[question.id] === idx
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={idx}
                          checked={answers[question.id] === idx}
                          onChange={() => handleAnswerChange(question.id, idx)}
                          className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs">{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Multiple Choice Question */}
                {question.type === 'multiple-choice' && question.options && (
                  <div className="space-y-1.5">
                    {question.options.map((option, idx) => (
                      <label
                        key={idx}
                        className={`flex items-center gap-2 p-2 border rounded-md cursor-pointer transition-colors ${
                          (answers[question.id] as number[] || []).includes(idx)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={(answers[question.id] as number[] || []).includes(idx)}
                          onChange={(e) => handleMultipleChoiceChange(question.id, idx, e.target.checked)}
                          className="h-3.5 w-3.5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-xs">{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Ranking Question */}
                {question.type === 'ranking' && question.options && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-500 mb-1">
                      Use arrows to reorder from most to least important
                    </p>
                    {(() => {
                      // Get current ranking as indices, or default to [0, 1, 2, ...]
                      const currentIndices = (answers[question.id] as number[]) ||
                        question.options!.map((_, i) => i)

                      return currentIndices.map((optionIdx, position) => (
                        <div
                          key={position}
                          className="flex items-center gap-2 p-2 border border-gray-200 rounded-md bg-white"
                        >
                          <span className="text-xs font-medium text-gray-500 w-5">{position + 1}.</span>
                          <span className="text-xs flex-1">{question.options![optionIdx]}</span>
                          <div className="flex gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (position > 0) {
                                  const newOrder = [...currentIndices]
                                  ;[newOrder[position - 1], newOrder[position]] = [newOrder[position], newOrder[position - 1]]
                                  handleRankingChange(question.id, newOrder)
                                }
                              }}
                              disabled={position === 0}
                              className="text-xs px-1.5 py-0.5 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const maxPosition = currentIndices.length - 1
                                if (position < maxPosition) {
                                  const newOrder = [...currentIndices]
                                  ;[newOrder[position], newOrder[position + 1]] = [newOrder[position + 1], newOrder[position]]
                                  handleRankingChange(question.id, newOrder)
                                }
                              }}
                              disabled={position === currentIndices.length - 1}
                              className="text-xs px-1.5 py-0.5 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                )}

                {/* Free Text Question */}
                {question.type === 'free-text' && (
                  <div>
                    <textarea
                      value={(answers[question.id] as string) || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      maxLength={question.maxLength || 500}
                      rows={3}
                      className="block w-full text-xs border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
                      placeholder={t('typeYourAnswer')}
                    />
                    <p className="text-xs text-gray-500 mt-0.5 text-right">
                      {((answers[question.id] as string) || '').length} / {question.maxLength || 500}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Submit Button */}
      <div className="bg-white shadow rounded-lg p-4">
        {!isWithinTimeFrame && (
          <div className="mb-3 p-2 bg-gray-50 border border-gray-200 rounded-md">
            <p className="text-xs text-gray-600">
              {t('notAcceptingResponses')}
            </p>
          </div>
        )}
        {!isQuestionnaireActive && (
          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-xs text-yellow-800">
              {currentLanguage === 'de'
                ? 'Dieser Fragebogen ist derzeit im Entwurfsmodus und akzeptiert keine Antworten.'
                : 'This questionnaire is currently in draft mode and not accepting responses.'}
            </p>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting || !isWithinTimeFrame || !isQuestionnaireActive}
          className="w-full py-2 px-3 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? t('submitting') : existingResponse ? t('updateResponse') : t('submitResponse')}
        </button>
      </div>
    </form>
  )
}

