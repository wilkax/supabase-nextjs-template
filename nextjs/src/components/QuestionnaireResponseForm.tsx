'use client'

import { useState, useEffect } from 'react'
import { createSPASassClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/types'
import { CheckCircle2, AlertCircle } from 'lucide-react'

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
  [questionId: string]: any
}

interface Props {
  questionnaire: Questionnaire
  participant: Participant
  existingResponse: QuestionnaireResponse | null
}

export default function QuestionnaireResponseForm({ 
  questionnaire, 
  participant, 
  existingResponse 
}: Props) {
  const [answers, setAnswers] = useState<Answers>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(!!existingResponse)
  const [error, setError] = useState<string | null>(null)

  const schema = questionnaire.schema as QuestionnaireSchema

  useEffect(() => {
    if (existingResponse && existingResponse.answers) {
      setAnswers(existingResponse.answers as Answers)
    }
  }, [existingResponse])

  function handleAnswerChange(questionId: string, value: any) {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }))
  }

  function handleMultipleChoiceChange(questionId: string, option: string, checked: boolean) {
    setAnswers(prev => {
      const current = (prev[questionId] as string[]) || []
      if (checked) {
        return { ...prev, [questionId]: [...current, option] }
      } else {
        return { ...prev, [questionId]: current.filter(o => o !== option) }
      }
    })
  }

  function handleRankingChange(questionId: string, options: string[]) {
    setAnswers(prev => ({
      ...prev,
      [questionId]: options
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

    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    if (existingResponse) {
      // Update existing response
      const { error: updateError } = await supabase
        .from('questionnaire_responses')
        .update({ 
          answers: answers,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingResponse.id)

      if (updateError) {
        setError('Failed to update response. Please try again.')
        setSubmitting(false)
        return
      }
    } else {
      // Create new response
      const { error: insertError } = await supabase
        .from('questionnaire_responses')
        .insert({
          questionnaire_id: questionnaire.id,
          participant_id: participant.id,
          answers: answers,
          submitted_at: new Date().toISOString()
        })

      if (insertError) {
        setError('Failed to submit response. Please try again.')
        setSubmitting(false)
        return
      }
    }

    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {existingResponse ? 'Response Updated!' : 'Thank You!'}
        </h2>
        <p className="text-gray-600">
          {existingResponse
            ? 'Your response has been successfully updated.'
            : 'Your response has been submitted successfully.'}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {schema.sections.map((section, sectionIndex) => (
        <div key={section.id} className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {section.title}
          </h3>
          {section.description && (
            <p className="text-sm text-gray-600 mb-4">{section.description}</p>
          )}

          <div className="space-y-6">
            {section.questions.map((question, questionIndex) => (
              <div key={question.id} className="border-l-4 border-blue-500 pl-4">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  {sectionIndex + 1}.{questionIndex + 1} {question.text}
                  {question.required !== false && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>

                {/* Scale Question */}
                {question.type === 'scale' && question.scale && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span>{question.scale.minLabel}</span>
                      <span>{question.scale.maxLabel}</span>
                    </div>
                    <div className="flex gap-2 justify-between">
                      {Array.from(
                        { length: question.scale.max - question.scale.min + 1 },
                        (_, i) => question.scale!.min + i
                      ).map((value) => (
                        <label
                          key={value}
                          className={`flex-1 flex flex-col items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
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
                          <span className="text-lg font-medium">{value}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Single Choice Question */}
                {question.type === 'single-choice' && question.options && (
                  <div className="space-y-2">
                    {question.options.map((option, idx) => (
                      <label
                        key={idx}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                          answers[question.id] === option
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={answers[question.id] === option}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Multiple Choice Question */}
                {question.type === 'multiple-choice' && question.options && (
                  <div className="space-y-2">
                    {question.options.map((option, idx) => (
                      <label
                        key={idx}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                          (answers[question.id] as string[] || []).includes(option)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={(answers[question.id] as string[] || []).includes(option)}
                          onChange={(e) => handleMultipleChoiceChange(question.id, option, e.target.checked)}
                          className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm">{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Ranking Question */}
                {question.type === 'ranking' && question.options && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 mb-2">
                      Drag to reorder from most to least important
                    </p>
                    {(answers[question.id] as string[] || question.options).map((option, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg bg-white"
                      >
                        <span className="text-sm font-medium text-gray-500 w-6">{idx + 1}.</span>
                        <span className="text-sm flex-1">{option}</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const current = (answers[question.id] as string[]) || [...question.options!]
                              if (idx > 0) {
                                const newOrder = [...current]
                                ;[newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]]
                                handleRankingChange(question.id, newOrder)
                              }
                            }}
                            disabled={idx === 0}
                            className="text-xs px-2 py-1 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const current = (answers[question.id] as string[]) || [...question.options!]
                              const maxIdx = current.length - 1
                              if (idx < maxIdx) {
                                const newOrder = [...current]
                                ;[newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]
                                handleRankingChange(question.id, newOrder)
                              }
                            }}
                            disabled={idx === ((answers[question.id] as string[]) || question.options).length - 1}
                            className="text-xs px-2 py-1 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Free Text Question */}
                {question.type === 'free-text' && (
                  <div>
                    <textarea
                      value={(answers[question.id] as string) || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      maxLength={question.maxLength || 500}
                      rows={4}
                      className="block w-full border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Type your answer here..."
                    />
                    <p className="text-xs text-gray-500 mt-1 text-right">
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
      <div className="bg-white shadow rounded-lg p-6">
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Submitting...' : existingResponse ? 'Update Response' : 'Submit Response'}
        </button>
      </div>
    </form>
  )
}

