'use client'

import { useEffect, useState, useCallback } from 'react'
import { createSPASassClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/types'
import { Plus, ArrowLeft, FileText, Edit2, Trash2, Languages, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { deleteApproach } from '@/app/[locale]/actions/approaches'
import {
  getVersionHistory,
  getVersionTranslations,
  translateQuestionnaireVersion,
  publishQuestionnaireVersion
} from '@/app/[locale]/actions/approach-questionnaires'

type Approach = Tables<'approaches'>
type ApproachQuestionnaire = Tables<'approach_questionnaires'>
type ApproachQuestionnaireVersion = Tables<'approach_questionnaire_versions'>
type ApproachQuestionnaireTranslation = Tables<'approach_questionnaire_translations'>

export default function ApproachDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const locale = (params.locale as string) || 'en'

  // Determine default language based on locale
  const defaultLanguage = (locale === 'de' ? 'de' : 'en') as 'en' | 'de'

  const [approach, setApproach] = useState<Approach | null>(null)
  const [questionnaires, setQuestionnaires] = useState<ApproachQuestionnaire[]>([])
  const [loading, setLoading] = useState(true)

  const [showQuestionnaireForm, setShowQuestionnaireForm] = useState(false)
  const [editingQuestionnaire, setEditingQuestionnaire] = useState<ApproachQuestionnaire | null>(null)
  const [questionnaireForm, setQuestionnaireForm] = useState({
    title: '',
    description: '',
    master_language: defaultLanguage,
  })

  // Version and translation state
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<ApproachQuestionnaire | null>(null)
  const [versions, setVersions] = useState<ApproachQuestionnaireVersion[]>([])
  const [translations, setTranslations] = useState<Record<string, ApproachQuestionnaireTranslation[]>>({})
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [translating, setTranslating] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    const { data: approachData } = await supabase
      .from('approaches')
      .select('*')
      .eq('id', id)
      .single()

    if (approachData) {
      setApproach(approachData)
    }

    const { data: questionnairesData } = await supabase
      .from('approach_questionnaires')
      .select('*')
      .eq('approach_id', id)
      .order('created_at', { ascending: false })

    if (questionnairesData) {
      setQuestionnaires(questionnairesData)
    }

    setLoading(false)
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function createOrUpdateQuestionnaire(e: React.FormEvent) {
    e.preventDefault()
    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    if (editingQuestionnaire) {
      const { error } = await supabase
        .from('approach_questionnaires')
        .update({
          title: questionnaireForm.title,
          description: questionnaireForm.description || null,
        })
        .eq('id', editingQuestionnaire.id)

      if (error) {
        console.error('Error updating questionnaire:', error)
        alert(`Error updating questionnaire: ${error.message}`)
        return
      }

      setShowQuestionnaireForm(false)
      setEditingQuestionnaire(null)
      setQuestionnaireForm({ title: '', description: '', master_language: defaultLanguage })
      loadData()
    } else {
      const { error } = await supabase
        .from('approach_questionnaires')
        .insert([{
          approach_id: id,
          title: questionnaireForm.title,
          description: questionnaireForm.description || null,
          schema: {},
          master_language: questionnaireForm.master_language,
        }])

      if (error) {
        console.error('Error creating questionnaire:', error)
        alert(`Error creating questionnaire: ${error.message}`)
        return
      }

      setShowQuestionnaireForm(false)
      setQuestionnaireForm({ title: '', description: '', master_language: defaultLanguage })
      loadData()
    }
  }

  function openEditForm(questionnaire: ApproachQuestionnaire) {
    setEditingQuestionnaire(questionnaire)
    setQuestionnaireForm({
      title: questionnaire.title,
      description: questionnaire.description || '',
      master_language: questionnaire.master_language as 'en' | 'de',
    })
    setShowQuestionnaireForm(true)
  }

  function openCreateForm() {
    setEditingQuestionnaire(null)
    setQuestionnaireForm({ title: '', description: '', master_language: defaultLanguage })
    setShowQuestionnaireForm(true)
  }

  async function deleteQuestionnaire(questionnaireId: string) {
    if (!confirm('Are you sure you want to delete this questionnaire template?')) return

    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    await supabase
      .from('approach_questionnaires')
      .delete()
      .eq('id', questionnaireId)

    loadData()
  }

  async function handleDeleteApproach() {
    if (!approach) return

    // Get organization count first
    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    const { count: orgCount } = await supabase
      .from('organization_approaches')
      .select('*', { count: 'exact', head: true })
      .eq('approach_id', approach.id)

    const warningMessage = orgCount && orgCount > 0
      ? `This approach is used by ${orgCount} organization(s). Are you sure you want to delete it? This action cannot be undone.`
      : 'Are you sure you want to delete this approach? This action cannot be undone.'

    if (!confirm(warningMessage)) {
      return
    }

    const result = await deleteApproach(approach.id)

    if (result.success) {
      alert('Approach deleted successfully')
      router.push('/app/admin/approaches')
    } else {
      alert(result.error || 'Failed to delete approach')
    }
  }

  async function loadVersionsAndTranslations(questionnaire: ApproachQuestionnaire) {
    setSelectedQuestionnaire(questionnaire)
    setLoadingVersions(true)

    const versionResult = await getVersionHistory(questionnaire.id)
    if (versionResult.success && versionResult.versions) {
      setVersions(versionResult.versions)

      // Load translations for each version
      const translationsMap: Record<string, ApproachQuestionnaireTranslation[]> = {}
      for (const version of versionResult.versions) {
        const translationResult = await getVersionTranslations(version.id)
        if (translationResult.success && translationResult.translations) {
          translationsMap[version.id] = translationResult.translations
        }
      }
      setTranslations(translationsMap)
    }

    setLoadingVersions(false)
  }

  async function handleTranslate(versionId: string, targetLanguage: 'en' | 'de') {
    setTranslating(versionId)

    const result = await translateQuestionnaireVersion(versionId, targetLanguage)

    if (result.success) {
      alert(`Translation to ${targetLanguage.toUpperCase()} completed successfully!`)
      // Reload versions and translations
      if (selectedQuestionnaire) {
        await loadVersionsAndTranslations(selectedQuestionnaire)
      }
    } else {
      alert(result.error || 'Translation failed')
    }

    setTranslating(null)
  }

  function closeVersionPanel() {
    setSelectedQuestionnaire(null)
    setVersions([])
    setTranslations({})
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!approach) {
    return <div className="p-6">Approach not found</div>
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-6">
        <Link
          href="/app/admin/approaches"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Approaches
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{approach.name}</h1>
        <p className="mt-2 text-sm text-gray-700">
          {approach.description || 'Manage questionnaire and report templates for this approach'}
        </p>
      </div>

      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Questionnaires
            </h3>
          </div>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Questionnaire
          </button>
        </div>
        <div className="px-4 py-5 sm:px-6">
          {questionnaires.length > 0 ? (
            <div className="space-y-3">
              {questionnaires.map((q) => (
                <div
                  key={q.id}
                  className="flex items-start justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-medium text-gray-900">{q.title}</h4>
                      {q.current_version > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          v{q.current_version}
                        </span>
                      )}
                      {q.has_draft_changes && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          <Clock className="h-3 w-3" />
                          Draft
                        </span>
                      )}
                    </div>
                    {q.description && (
                      <p className="mt-1 text-sm text-gray-600">{q.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      <span>Created: {new Date(q.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Master: {q.master_language.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <Link
                      href={`/app/admin/approaches/${id}/questionnaire/edit?qid=${q.id}`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </Link>
                    <button
                      onClick={() => loadVersionsAndTranslations(q)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-sm text-purple-600 hover:text-purple-700"
                    >
                      <Languages className="h-4 w-4" />
                      Versions
                    </button>
                    <button
                      onClick={() => openEditForm(q)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-700"
                    >
                      <Edit2 className="h-4 w-4" />
                      Rename
                    </button>
                    <button
                      onClick={() => deleteQuestionnaire(q.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-sm text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No questionnaires created yet. Create one to define the survey questions for this approach.
            </p>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white shadow rounded-lg p-6 border-2 border-red-200">
        <h2 className="text-lg font-medium text-red-900 mb-2">Danger Zone</h2>
        <p className="text-sm text-gray-600 mb-4">
          Once you delete an approach, there is no going back. This will affect all organizations using this approach. Please be certain.
        </p>
        <button
          onClick={handleDeleteApproach}
          className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-white hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete Approach
        </button>
      </div>

      {showQuestionnaireForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-medium mb-4">
              {editingQuestionnaire ? 'Edit Questionnaire' : 'Create Questionnaire'}
            </h2>
            <form onSubmit={createOrUpdateQuestionnaire} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  required
                  value={questionnaireForm.title}
                  onChange={(e) => setQuestionnaireForm({ ...questionnaireForm, title: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={questionnaireForm.description}
                  onChange={(e) => setQuestionnaireForm({ ...questionnaireForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              {!editingQuestionnaire && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Master Language
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    This language will be editable. Other languages will be read-only translations.
                  </p>
                  <div className="flex gap-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="master_language"
                        value="en"
                        checked={questionnaireForm.master_language === 'en'}
                        onChange={(e) => setQuestionnaireForm({ ...questionnaireForm, master_language: 'en' })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">English (EN)</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="master_language"
                        value="de"
                        checked={questionnaireForm.master_language === 'de'}
                        onChange={(e) => setQuestionnaireForm({ ...questionnaireForm, master_language: 'de' })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">German (DE)</span>
                    </label>
                  </div>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowQuestionnaireForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  {editingQuestionnaire ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version and Translation Panel */}
      {selectedQuestionnaire && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">
                  Versions & Translations
                </h2>
                <p className="text-sm text-gray-600 mt-1">{selectedQuestionnaire.title}</p>
              </div>
              <button
                onClick={closeVersionPanel}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingVersions ? (
                <div className="text-center py-8 text-gray-500">Loading versions...</div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No published versions yet.</p>
                  <p className="text-sm text-gray-400">
                    Edit the questionnaire and click "Publish Version" to create the first version.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {versions.map((version) => {
                    const versionTranslations = translations[version.id] || []
                    const hasEnTranslation = versionTranslations.some(t => t.language === 'en')
                    const hasDeTranslation = versionTranslations.some(t => t.language === 'de')
                    const masterLang = version.master_language

                    return (
                      <div key={version.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-medium text-gray-900">
                                Version {version.version}
                              </h3>
                              <span className="text-xs text-gray-500">
                                Master: {masterLang.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Published {new Date(version.published_at).toLocaleDateString()} at{' '}
                              {new Date(version.published_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Translations:</h4>
                          <div className="flex items-center gap-2">
                            {/* English */}
                            <div className="flex items-center gap-1">
                              {masterLang === 'en' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                                  <CheckCircle className="h-3 w-3" />
                                  EN (Master)
                                </span>
                              ) : hasEnTranslation ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3" />
                                  EN
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleTranslate(version.id, 'en')}
                                  disabled={translating === version.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                                >
                                  <Languages className="h-3 w-3" />
                                  {translating === version.id ? 'Translating...' : 'Translate to EN'}
                                </button>
                              )}
                            </div>

                            {/* German */}
                            <div className="flex items-center gap-1">
                              {masterLang === 'de' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                                  <CheckCircle className="h-3 w-3" />
                                  DE (Master)
                                </span>
                              ) : hasDeTranslation ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3" />
                                  DE
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleTranslate(version.id, 'de')}
                                  disabled={translating === version.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                                >
                                  <Languages className="h-3 w-3" />
                                  {translating === version.id ? 'Translating...' : 'Translate to DE'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
