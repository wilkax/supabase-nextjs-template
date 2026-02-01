'use client'

import { useEffect, useState } from 'react'
import { createSPASassClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/types'
import { ArrowLeft, Plus, Trash2, GripVertical, Save } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

type ApproachQuestionnaire = Tables<'approach_questionnaires'>

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
  options?: string[]  // For single-choice, multiple-choice, ranking
  maxLength?: number  // For free-text
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

export default function QuestionnaireEditorPage() {
  const params = useParams()
  const router = useRouter()
  const approachId = params.id as string

  const [questionnaire, setQuestionnaire] = useState<ApproachQuestionnaire | null>(null)
  const [schema, setSchema] = useState<QuestionnaireSchema>({ sections: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [approachId])

  async function loadData() {
    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    const { data } = await supabase
      .from('approach_questionnaires')
      .select('*')
      .eq('approach_id', approachId)
      .maybeSingle()

    if (data) {
      setQuestionnaire(data)
      setSchema((data.schema as QuestionnaireSchema) || { sections: [] })
    }

    setLoading(false)
  }

  async function saveQuestionnaire() {
    if (!questionnaire) return

    setSaving(true)
    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    const { error } = await supabase
      .from('approach_questionnaires')
      .update({ schema: schema })
      .eq('id', questionnaire.id)

    setSaving(false)

    if (!error) {
      router.push(`/app/admin/approaches/${approachId}`)
    }
  }

  function addSection() {
    const newSection: Section = {
      id: `section-${Date.now()}`,
      title: 'New Section',
      description: '',
      questions: []
    }
    setSchema({ ...schema, sections: [...schema.sections, newSection] })
  }

  function updateSection(index: number, field: keyof Section, value: string) {
    const newSections = [...schema.sections]
    newSections[index] = { ...newSections[index], [field]: value }
    setSchema({ ...schema, sections: newSections })
  }

  function deleteSection(index: number) {
    const newSections = schema.sections.filter((_, i) => i !== index)
    setSchema({ ...schema, sections: newSections })
  }

  function addQuestion(sectionIndex: number, type: Question['type'] = 'scale') {
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      text: 'New question',
      type: type,
      required: true
    }

    // Add type-specific defaults
    if (type === 'scale') {
      newQuestion.scale = {
        min: 1,
        max: 5,
        minLabel: 'Strongly Disagree',
        maxLabel: 'Strongly Agree'
      }
    } else if (type === 'single-choice' || type === 'multiple-choice' || type === 'ranking') {
      newQuestion.options = ['Option 1', 'Option 2', 'Option 3']
    } else if (type === 'free-text') {
      newQuestion.maxLength = 500
    }

    const newSections = [...schema.sections]
    newSections[sectionIndex].questions.push(newQuestion)
    setSchema({ ...schema, sections: newSections })
  }

  function updateQuestion(sectionIndex: number, questionIndex: number, field: string, value: any) {
    const newSections = [...schema.sections]
    if (field.startsWith('scale.')) {
      const scaleField = field.split('.')[1]
      newSections[sectionIndex].questions[questionIndex].scale = {
        ...newSections[sectionIndex].questions[questionIndex].scale!,
        [scaleField]: value
      }
    } else {
      newSections[sectionIndex].questions[questionIndex] = {
        ...newSections[sectionIndex].questions[questionIndex],
        [field]: value
      }
    }
    setSchema({ ...schema, sections: newSections })
  }

  function deleteQuestion(sectionIndex: number, questionIndex: number) {
    const newSections = [...schema.sections]
    newSections[sectionIndex].questions = newSections[sectionIndex].questions.filter((_, i) => i !== questionIndex)
    setSchema({ ...schema, sections: newSections })
  }

  function changeQuestionType(sectionIndex: number, questionIndex: number, newType: Question['type']) {
    const newSections = [...schema.sections]
    const question = newSections[sectionIndex].questions[questionIndex]

    // Remove old type-specific fields
    delete question.scale
    delete question.options
    delete question.maxLength

    // Set new type
    question.type = newType

    // Add new type-specific defaults
    if (newType === 'scale') {
      question.scale = {
        min: 1,
        max: 5,
        minLabel: 'Strongly Disagree',
        maxLabel: 'Strongly Agree'
      }
    } else if (newType === 'single-choice' || newType === 'multiple-choice' || newType === 'ranking') {
      question.options = ['Option 1', 'Option 2', 'Option 3']
    } else if (newType === 'free-text') {
      question.maxLength = 500
    }

    setSchema({ ...schema, sections: newSections })
  }

  function addOption(sectionIndex: number, questionIndex: number) {
    const newSections = [...schema.sections]
    const question = newSections[sectionIndex].questions[questionIndex]
    if (question.options) {
      question.options.push(`Option ${question.options.length + 1}`)
    }
    setSchema({ ...schema, sections: newSections })
  }

  function updateOption(sectionIndex: number, questionIndex: number, optionIndex: number, value: string) {
    const newSections = [...schema.sections]
    const question = newSections[sectionIndex].questions[questionIndex]
    if (question.options) {
      question.options[optionIndex] = value
    }
    setSchema({ ...schema, sections: newSections })
  }

  function deleteOption(sectionIndex: number, questionIndex: number, optionIndex: number) {
    const newSections = [...schema.sections]
    const question = newSections[sectionIndex].questions[questionIndex]
    if (question.options) {
      question.options = question.options.filter((_, i) => i !== optionIndex)
    }
    setSchema({ ...schema, sections: newSections })
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!questionnaire) {
    return <div className="p-6">Questionnaire not found</div>
  }

  return (
    <div className="px-4 sm:px-0 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/app/admin/approaches/${approachId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Approach
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Questionnaire</h1>
            <p className="mt-1 text-sm text-gray-600">{questionnaire.title}</p>
          </div>
          <button
            onClick={saveQuestionnaire}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {schema.sections.map((section, sectionIndex) => (
          <div key={section.id} className="bg-white shadow rounded-lg p-6">
            {/* Section Header */}
            <div className="flex items-start gap-4 mb-4">
              <GripVertical className="h-5 w-5 text-gray-400 mt-2 cursor-move" />
              <div className="flex-1 space-y-3">
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => updateSection(sectionIndex, 'title', e.target.value)}
                  className="block w-full text-lg font-medium border-0 border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-0 px-0"
                  placeholder="Section title"
                />
                <textarea
                  value={section.description || ''}
                  onChange={(e) => updateSection(sectionIndex, 'description', e.target.value)}
                  className="block w-full text-sm border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-0 px-0"
                  placeholder="Section description (optional)"
                  rows={2}
                />
              </div>
              <button
                onClick={() => deleteSection(sectionIndex)}
                className="text-red-600 hover:text-red-700 p-2"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>

            {/* Questions */}
            <div className="ml-9 space-y-4">
              {section.questions.map((question, questionIndex) => (
                <div key={question.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-medium text-gray-500 mt-2">
                      {sectionIndex + 1}.{questionIndex + 1}
                    </span>
                    <div className="flex-1 space-y-3">
                      {/* Question Text */}
                      <textarea
                        value={question.text}
                        onChange={(e) => updateQuestion(sectionIndex, questionIndex, 'text', e.target.value)}
                        className="block w-full text-sm border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Question text"
                        rows={2}
                      />

                      {/* Question Type Selector */}
                      <div className="flex items-center gap-4">
                        <label className="text-xs font-medium text-gray-700">Type:</label>
                        <select
                          value={question.type}
                          onChange={(e) => changeQuestionType(sectionIndex, questionIndex, e.target.value as Question['type'])}
                          className="text-xs border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
                        >
                          <option value="scale">Scale (1-5)</option>
                          <option value="single-choice">Single Choice</option>
                          <option value="multiple-choice">Multiple Choice</option>
                          <option value="ranking">Ranking</option>
                          <option value="free-text">Free Text</option>
                        </select>
                        <label className="inline-flex items-center text-xs">
                          <input
                            type="checkbox"
                            checked={question.required !== false}
                            onChange={(e) => updateQuestion(sectionIndex, questionIndex, 'required', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-1"
                          />
                          Required
                        </label>
                      </div>

                      {/* Type-specific configuration */}
                      {question.type === 'scale' && question.scale && (
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Min ({question.scale.min})
                            </label>
                            <input
                              type="text"
                              value={question.scale.minLabel}
                              onChange={(e) => updateQuestion(sectionIndex, questionIndex, 'scale.minLabel', e.target.value)}
                              className="block w-full text-sm border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
                              placeholder="Min label"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Max ({question.scale.max})
                            </label>
                            <input
                              type="text"
                              value={question.scale.maxLabel}
                              onChange={(e) => updateQuestion(sectionIndex, questionIndex, 'scale.maxLabel', e.target.value)}
                              className="block w-full text-sm border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
                              placeholder="Max label"
                            />
                          </div>
                        </div>
                      )}

                      {(question.type === 'single-choice' || question.type === 'multiple-choice' || question.type === 'ranking') && question.options && (
                        <div className="pt-2 border-t border-gray-200">
                          <label className="block text-xs font-medium text-gray-700 mb-2">Options:</label>
                          <div className="space-y-2">
                            {question.options.map((option, optionIndex) => (
                              <div key={optionIndex} className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-6">{optionIndex + 1}.</span>
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => updateOption(sectionIndex, questionIndex, optionIndex, e.target.value)}
                                  className="flex-1 text-sm border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
                                  placeholder={`Option ${optionIndex + 1}`}
                                />
                                <button
                                  onClick={() => deleteOption(sectionIndex, questionIndex, optionIndex)}
                                  className="text-red-600 hover:text-red-700 p-1"
                                  disabled={question.options!.length <= 2}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => addOption(sectionIndex, questionIndex)}
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              + Add Option
                            </button>
                          </div>
                        </div>
                      )}

                      {question.type === 'free-text' && (
                        <div className="pt-2 border-t border-gray-200">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Max Length (characters)
                          </label>
                          <input
                            type="number"
                            value={question.maxLength || 500}
                            onChange={(e) => updateQuestion(sectionIndex, questionIndex, 'maxLength', parseInt(e.target.value))}
                            className="block w-32 text-sm border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
                            min="1"
                            max="10000"
                          />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteQuestion(sectionIndex, questionIndex)}
                      className="text-red-600 hover:text-red-700 p-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add Question Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => addQuestion(sectionIndex, 'scale')}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md border border-blue-200"
                >
                  <Plus className="h-3 w-3" />
                  Scale
                </button>
                <button
                  onClick={() => addQuestion(sectionIndex, 'single-choice')}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md border border-blue-200"
                >
                  <Plus className="h-3 w-3" />
                  Single Choice
                </button>
                <button
                  onClick={() => addQuestion(sectionIndex, 'multiple-choice')}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md border border-blue-200"
                >
                  <Plus className="h-3 w-3" />
                  Multiple Choice
                </button>
                <button
                  onClick={() => addQuestion(sectionIndex, 'ranking')}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md border border-blue-200"
                >
                  <Plus className="h-3 w-3" />
                  Ranking
                </button>
                <button
                  onClick={() => addQuestion(sectionIndex, 'free-text')}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md border border-blue-200"
                >
                  <Plus className="h-3 w-3" />
                  Free Text
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add Section Button */}
        <button
          onClick={addSection}
          className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700"
        >
          <Plus className="h-5 w-5 mx-auto mb-1" />
          Add Section
        </button>
      </div>
    </div>
  )
}

