'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { createSPASassClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/types'
import { ArrowLeft, BarChart3, Link2, Copy, Check, Calendar, Users, Upload, Mail, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { generateAnonymousInviteLink, updateQuestionnaireDates, getQuestionnaireInviteLink, importParticipants, getParticipantsWithLinks, sendParticipantInvitations, deleteParticipants, deleteQuestionnaire } from '@/app/[locale]/actions/questionnaires'

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
  const t = useTranslations('organization')
  const c = useTranslations('common')
  const router = useRouter()
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
  const [showImportParticipants, setShowImportParticipants] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [participantLinks, setParticipantLinks] = useState<Array<{ participantId: string; email: string; name: string; link: string }>>([])
  const [copiedParticipantId, setCopiedParticipantId] = useState<string | null>(null)
  const [sendingEmails, setSendingEmails] = useState(false)
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'settings' | 'questionnaire' | 'participants'>('settings')

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

      // Load participants with links for named questionnaires
      if (!questionnaireData.is_anonymous && orgData) {
        const result = await getParticipantsWithLinks(id, orgData.id)
        if (result.success && result.participants) {
          setParticipantLinks(result.participants)
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

  async function handleImportParticipants() {
    if (!organization || !questionnaire || !importText.trim()) return

    setImporting(true)

    // Parse the input - support comma-separated OR one per line
    let emails: string[] = []

    // Check if comma-separated (single line with commas)
    if (importText.includes(',') && !importText.includes('\n')) {
      emails = importText.split(',').map(e => e.trim()).filter(e => e.includes('@'))
    } else {
      // One per line (or mixed)
      const lines = importText.split(/[\n,]/).map(e => e.trim()).filter(e => e)
      emails = lines.filter(e => e.includes('@'))
    }

    if (emails.length === 0) {
      alert('No valid email addresses found')
      setImporting(false)
      return
    }

    const participants = emails.map(email => ({ email }))

    const result = await importParticipants(
      questionnaire.id,
      organization.id,
      participants
    )

    setImporting(false)

    if (result.success) {
      alert(`Successfully imported ${result.imported} participants`)
      setShowImportParticipants(false)
      setImportText('')
      loadData()
    } else {
      alert(result.error || 'Failed to import participants')
    }
  }

  async function handleCopyParticipantLink(participantId: string, link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopiedParticipantId(participantId)
      setTimeout(() => setCopiedParticipantId(null), 2000)
    } catch (err) {
      alert('Failed to copy link to clipboard')
    }
  }

  async function handleDeleteSelectedParticipants() {
    if (!organization) return

    if (selectedParticipants.size === 0) {
      alert('Please select participants to delete')
      return
    }

    const count = selectedParticipants.size
    if (!confirm(`Are you sure you want to delete ${count} participant(s)? This will also delete their invitation links.`)) {
      return
    }

    const participantIds = Array.from(selectedParticipants)
    const result = await deleteParticipants(participantIds, organization.id)

    if (result.success) {
      // Remove from local state
      setParticipantLinks(prev => prev.filter(p => !selectedParticipants.has(p.participantId)))
      setSelectedParticipants(new Set())
      alert(`Successfully deleted ${result.deleted} participant(s)`)
    } else {
      alert(result.error || 'Failed to delete participants')
    }
  }

  async function handleDeleteQuestionnaire() {
    if (!questionnaire || !organization) return

    // Get response count first
    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    const { count: responseCount } = await supabase
      .from('questionnaire_responses')
      .select('*', { count: 'exact', head: true })
      .eq('questionnaire_id', questionnaire.id)

    const warningMessage = responseCount && responseCount > 0
      ? `This questionnaire has ${responseCount} response(s). Are you sure you want to delete it? This action cannot be undone.`
      : 'Are you sure you want to delete this questionnaire? This action cannot be undone.'

    if (!confirm(warningMessage)) {
      return
    }

    const result = await deleteQuestionnaire(questionnaire.id, organization.id)

    if (result.success) {
      alert('Questionnaire deleted successfully')
      router.push(`/app/org/${slug}/questionnaires`)
    } else {
      alert(result.error || 'Failed to delete questionnaire')
    }
  }

  async function handleSendEmailInvitations() {
    if (!organization || !questionnaire) return

    const participantIds = selectedParticipants.size > 0
      ? Array.from(selectedParticipants)
      : undefined

    if (selectedParticipants.size === 0 && participantLinks.length === 0) {
      alert('Please generate invitation links first')
      return
    }

    const confirmMessage = selectedParticipants.size > 0
      ? `Send email invitations to ${selectedParticipants.size} selected participant(s)?`
      : `Send email invitations to all ${participantLinks.length} participant(s)?`

    if (!confirm(confirmMessage)) return

    setSendingEmails(true)
    const result = await sendParticipantInvitations(
      questionnaire.id,
      organization.id,
      participantIds
    )
    setSendingEmails(false)

    if (result.success) {
      alert(`Successfully sent ${result.sent} email invitation(s)!\n\nNote: Email sending is currently in demo mode. Check the server console for email content.`)
      setSelectedParticipants(new Set())
    } else {
      alert(result.error || 'Failed to send email invitations')
    }
  }

  function toggleParticipantSelection(participantId: string) {
    const newSelection = new Set(selectedParticipants)
    if (newSelection.has(participantId)) {
      newSelection.delete(participantId)
    } else {
      newSelection.add(participantId)
    }
    setSelectedParticipants(newSelection)
  }

  function toggleSelectAll() {
    if (selectedParticipants.size === participantLinks.length) {
      setSelectedParticipants(new Set())
    } else {
      setSelectedParticipants(new Set(participantLinks.map(p => p.participantId)))
    }
  }

  if (loading) {
    return <div className="p-6">{c('loading')}</div>
  }

  if (!questionnaire || !organization) {
    return <div className="p-6">{t('questionnaireNotFound')}</div>
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

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('settings')}
            className={`${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab('questionnaire')}
            className={`${
              activeTab === 'questionnaire'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Questionnaire
          </button>
          {!questionnaire.is_anonymous && (
            <button
              onClick={() => setActiveTab('participants')}
              className={`${
                activeTab === 'participants'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Participants
            </button>
          )}
        </nav>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <>
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

          {/* Invitation Link Section - for anonymous questionnaires */}
          {questionnaire.is_anonymous && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">{c('anonymousInvitationLink')}</h2>
              <p className="text-sm text-gray-600 mb-4">
                {c('generateLinkDescription')}
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
                    {c('generateNewLink')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">{c('actions')}</h2>
            <div className="flex gap-3 flex-wrap">
              {questionnaire.status === 'draft' && (
                <button
                  onClick={() => updateStatus('active')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                >
                  {c('activateQuestionnaire')}
                </button>
              )}
              {questionnaire.status === 'active' && (
                <button
                  onClick={() => updateStatus('closed')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                >
                  {c('closeQuestionnaire')}
                </button>
              )}
              {(questionnaire.status === 'closed' || questionnaire.status === 'draft') && (
                <button
                  onClick={() => updateStatus('archived')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                >
                  {c('archive')}
                </button>
              )}
              <Link
                href={`/app/org/${slug}/questionnaires/${id}/reports`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700"
              >
                <BarChart3 className="h-4 w-4" />
                {c('viewReports')}
              </Link>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white shadow rounded-lg p-6 border-2 border-red-200">
            <h2 className="text-lg font-medium text-red-900 mb-2">Danger Zone</h2>
            <p className="text-sm text-gray-600 mb-4">
              Once you delete a questionnaire, there is no going back. Please be certain.
            </p>
            <button
              onClick={handleDeleteQuestionnaire}
              className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-white hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete Questionnaire
            </button>
          </div>
        </>
      )}

      {/* Questionnaire Tab */}
      {activeTab === 'questionnaire' && (
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
            <p className="text-sm text-gray-500">{t('noQuestionsDefined')}</p>
          )}
        </div>
      )}

      {/* Participants Tab */}
      {activeTab === 'participants' && !questionnaire.is_anonymous && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Participant Management
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Import participant email addresses and generate personalized invitation links.
          </p>

          <div className="flex gap-3 mb-6 flex-wrap">
            <button
              onClick={() => setShowImportParticipants(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <Upload className="h-4 w-4" />
              Import Participants
            </button>
            {participantLinks.length > 0 && (
              <>
                <button
                  onClick={handleSendEmailInvitations}
                  disabled={sendingEmails}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                >
                  <Mail className="h-4 w-4" />
                  {sendingEmails ? 'Sending...' : selectedParticipants.size > 0 ? `Send to ${selectedParticipants.size} Selected` : 'Send to All'}
                </button>
                {selectedParticipants.size > 0 && (
                  <button
                    onClick={handleDeleteSelectedParticipants}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove {selectedParticipants.size} Selected
                  </button>
                )}
              </>
            )}
          </div>

          {/* Participant Links Table */}
          {participantLinks.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Invitation Links ({participantLinks.length} participants)
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedParticipants.size === participantLinks.length && participantLinks.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invitation Link</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {participantLinks.map((participant) => (
                      <tr key={participant.participantId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedParticipants.has(participant.participantId)}
                            onChange={() => toggleParticipantSelection(participant.participantId)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{participant.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{participant.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 font-mono truncate max-w-xs">
                          {participant.link}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <button
                            onClick={() => handleCopyParticipantLink(participant.participantId, participant.link)}
                            className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded transition-colors ${
                              copiedParticipantId === participant.participantId
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {copiedParticipantId === participant.participantId ? (
                              <>
                                <Check className="h-3 w-3" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Copy
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

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

      {/* Import Participants Modal */}
      {showImportParticipants && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-lg font-medium mb-4">Import Participants</h2>
            <p className="text-sm text-gray-600 mb-4">
              Enter email addresses only (one per line OR comma-separated):
            </p>
            <div className="space-y-4">
              <div>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com&#10;&#10;OR comma-separated:&#10;user1@example.com, user2@example.com, user3@example.com"
                  rows={10}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
                />
                <p className="mt-2 text-xs text-gray-500">
                  One per line OR comma-separated (e.g., email1@example.com, email2@example.com)
                </p>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportParticipants(false)
                    setImportText('')
                  }}
                  disabled={importing}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportParticipants}
                  disabled={importing || !importText.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {importing ? 'Importing...' : 'Import Participants'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

