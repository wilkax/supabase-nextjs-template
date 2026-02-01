'use client'

import { useEffect, useState } from 'react'
import { createSPASassClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/types'
import { ArrowLeft, Calendar, Users, Settings, Eye } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type Questionnaire = Tables<'questionnaires'>
type Organization = Tables<'organizations'>

interface QuestionnaireSchema {
  sections: Array<{
    id: string
    title: string
    description?: string
    questions: Array<{
      id: string
      text: string
      type: string
      required?: boolean
      scale?: {
        min: number
        max: number
        minLabel: string
        maxLabel: string
      }
      options?: string[]
      maxLength?: number
    }>
  }>
}

export default function QuestionnaireDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const id = params.id as string

  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id, slug])

  async function loadData() {
    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    // Get organization
    const { data: orgData } = await supabase
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .single()

    if (orgData) {
      setOrganization(orgData)
    }

    // Get questionnaire
    const { data: questionnaireData } = await supabase
      .from('questionnaires')
      .select('*')
      .eq('id', id)
      .single()

    if (questionnaireData) {
      setQuestionnaire(questionnaireData)
    }

    setLoading(false)
  }

  async function updateStatus(newStatus: string) {
    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    const { error } = await supabase
      .from('questionnaires')
      .update({ status: newStatus })
      .eq('id', id)

    if (!error) {
      loadData()
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!questionnaire || !organization) {
    return <div className="p-6">Questionnaire not found</div>
  }

  const schema = questionnaire.schema as QuestionnaireSchema
  const totalQuestions = schema.sections?.reduce((sum, section) => sum + (section.questions?.length || 0), 0) || 0

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/app/org/${slug}/questionnaires`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Questionnaires
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{questionnaire.title}</h1>
            {questionnaire.description && (
              <p className="mt-2 text-sm text-gray-700">{questionnaire.description}</p>
            )}
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            questionnaire.status === 'active' ? 'bg-green-100 text-green-800' :
            questionnaire.status === 'draft' ? 'bg-gray-100 text-gray-800' :
            questionnaire.status === 'closed' ? 'bg-blue-100 text-blue-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {questionnaire.status}
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Details</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Anonymous Responses</dt>
            <dd className="mt-1 text-sm text-gray-900">{questionnaire.is_anonymous ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Total Questions</dt>
            <dd className="mt-1 text-sm text-gray-900">{totalQuestions}</dd>
          </div>
          {questionnaire.start_date && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Start Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(questionnaire.start_date).toLocaleDateString()}
              </dd>
            </div>
          )}
          {questionnaire.end_date && (
            <div>
              <dt className="text-sm font-medium text-gray-500">End Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(questionnaire.end_date).toLocaleDateString()}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-sm font-medium text-gray-500">Created</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(questionnaire.created_at).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>

      {/* Questions */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Questions</h2>
        {schema.sections && schema.sections.length > 0 ? (
          <div className="space-y-6">
            {schema.sections.map((section, sectionIndex) => (
              <div key={section.id} className="border-l-4 border-blue-500 pl-4">
                <h3 className="text-base font-medium text-gray-900 mb-2">
                  {sectionIndex + 1}. {section.title}
                </h3>
                {section.description && (
                  <p className="text-sm text-gray-600 mb-3">{section.description}</p>
                )}
                <div className="space-y-3">
                  {section.questions.map((question, questionIndex) => (
                    <div key={question.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <p className="text-sm font-medium text-gray-900 flex-1">
                          {sectionIndex + 1}.{questionIndex + 1} {question.text}
                        </p>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          {question.type === 'scale' ? 'Scale' :
                           question.type === 'single-choice' ? 'Single Choice' :
                           question.type === 'multiple-choice' ? 'Multiple Choice' :
                           question.type === 'ranking' ? 'Ranking' :
                           'Free Text'}
                        </span>
                      </div>
                      {question.type === 'scale' && question.scale && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                          <span>{question.scale.minLabel} ({question.scale.min})</span>
                          <span>→</span>
                          <span>{question.scale.maxLabel} ({question.scale.max})</span>
                        </div>
                      )}
                      {(question.type === 'single-choice' || question.type === 'multiple-choice' || question.type === 'ranking') && question.options && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-700 mb-1">Options:</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {question.options.map((option, idx) => (
                              <li key={idx}>• {option}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {question.type === 'free-text' && question.maxLength && (
                        <div className="mt-2 text-xs text-gray-500">
                          Max length: {question.maxLength} characters
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No questions defined</p>
        )}
      </div>

      {/* Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Actions</h2>
        <div className="flex gap-3">
          {questionnaire.status === 'draft' && (
            <button
              onClick={() => updateStatus('active')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
            >
              Activate Questionnaire
            </button>
          )}
          {questionnaire.status === 'active' && (
            <button
              onClick={() => updateStatus('closed')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Close Questionnaire
            </button>
          )}
          {(questionnaire.status === 'closed' || questionnaire.status === 'draft') && (
            <button
              onClick={() => updateStatus('archived')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              Archive
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

