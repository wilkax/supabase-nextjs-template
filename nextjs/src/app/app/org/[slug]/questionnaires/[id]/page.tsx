'use client'

import { useEffect, useState, useCallback } from 'react'
import { createSPASassClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/types'
import { ArrowLeft, BarChart3, Link2, Copy, Check, Calendar } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { generateAnonymousInviteLink, updateQuestionnaireDates, getQuestionnaireInviteLink } from '@/app/actions/questionnaires'

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
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showEditDates, setShowEditDates] = useState(false)
  const [editingDates, setEditingDates] = useState(false)
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')

  const loadData = useCallback(async () => {
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

      // Load existing invitation link for anonymous questionnaires
      if (questionnaireData.is_anonymous && orgData) {
        const result = await getQuestionnaireInviteLink(id, orgData.id)
        if (result.success && result.link) {
          setInviteLink(result.link)
        }
      }
    }

    setLoading(false)
  }, [id, slug])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function updateStatus(newStatus: 'draft' | 'active' | 'closed' | 'archived') {
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

  async function handleGenerateInviteLink() {
    if (!organization || !questionnaire) return

    setGeneratingLink(true)
    const result = await generateAnonymousInviteLink(questionnaire.id, organization.id)
    setGeneratingLink(false)

    if (result.success && result.link) {
      setInviteLink(result.link)
    } else {
      alert(result.error || 'Failed to generate invite link')
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return

    try {
      await navigator.clipboard.writeText(inviteLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (err) {
      alert('Failed to copy link to clipboard')
    }
  }

  async function handleUpdateDates() {
    if (!organization || !questionnaire) return

    setEditingDates(true)
    const result = await updateQuestionnaireDates(
      questionnaire.id,
      organization.id,
      editStartDate || null,
      editEndDate || null
    )
    setEditingDates(false)

    if (result.success) {
      setShowEditDates(false)
      loadData()
    } else {
      alert(result.error || 'Failed to update dates')
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!questionnaire || !organization) {
    return <div className="p-6">Questionnaire not found</div>
  }

  // Type guard: check if schema has the expected structure
  const schemaData = questionnaire.schema
  let schema: QuestionnaireSchema = { sections: [] }

  if (
    schemaData &&
    typeof schemaData === 'object' &&
    !Array.isArray(schemaData) &&
    'sections' in schemaData &&
    Array.isArray(schemaData.sections)
  ) {
    schema = schemaData as unknown as QuestionnaireSchema
  }

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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Details</h2>
          <button
            onClick={() => {
              setEditStartDate(questionnaire.start_date || '')
              setEditEndDate(questionnaire.end_date || '')
              setShowEditDates(true)
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            <Calendar className="h-4 w-4" />
            Edit Dates
          </button>
        </div>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Anonymous Responses</dt>
            <dd className="mt-1 text-sm text-gray-900">{questionnaire.is_anonymous ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Total Questions</dt>
            <dd className="mt-1 text-sm text-gray-900">{totalQuestions}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Start Date</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {questionnaire.start_date ? new Date(questionnaire.start_date).toLocaleDateString() : 'Not set'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">End Date</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {questionnaire.end_date ? new Date(questionnaire.end_date).toLocaleDateString() : 'Not set'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(questionnaire.created_at).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>

      {/* Edit Dates Modal */}
      {showEditDates && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-medium mb-4">Edit Questionnaire Dates</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditDates(false)}
                  disabled={editingDates}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateDates}
                  disabled={editingDates}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {editingDates ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Invitation Link Section */}
      {questionnaire.is_anonymous && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Anonymous Invitation Link</h2>
          <p className="text-sm text-gray-600 mb-4">
            Generate a link that allows anonymous users to respond to this questionnaire.
          </p>

          {!inviteLink ? (
            <button
              onClick={handleGenerateInviteLink}
              disabled={generatingLink}
              className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <Link2 className="h-4 w-4" />
              {generatingLink ? 'Generating...' : 'Generate Invitation Link'}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                />
                <button
                  onClick={handleCopyLink}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    linkCopied
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {linkCopied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <button
                onClick={handleGenerateInviteLink}
                disabled={generatingLink}
                className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                Generate new link
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Actions</h2>
        <div className="flex gap-3 flex-wrap">
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
          <Link
            href={`/app/org/${slug}/questionnaires/${id}/reports`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700"
          >
            <BarChart3 className="h-4 w-4" />
            View Reports
          </Link>
        </div>
      </div>
    </div>
  )
}

