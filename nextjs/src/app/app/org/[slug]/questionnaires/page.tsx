'use client'

import { useEffect, useState, useCallback } from 'react'
import { createSPASassClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/types'
import { Plus, Calendar, Users, Eye } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'

type Organization = Tables<'organizations'>
type Questionnaire = Tables<'questionnaires'>
type Approach = Tables<'approaches'>
type ApproachQuestionnaire = Tables<'approach_questionnaires'>

interface ApproachWithQuestionnaire extends Approach {
  questionnaire: ApproachQuestionnaire | null
}

export default function QuestionnairesPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [org, setOrg] = useState<Organization | null>(null)
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
  const [approaches, setApproaches] = useState<ApproachWithQuestionnaire[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedApproach, setSelectedApproach] = useState<ApproachWithQuestionnaire | null>(null)
  const [newQuestionnaire, setNewQuestionnaire] = useState({
    title: '',
    description: '',
    is_anonymous: false,
    start_date: '',
    end_date: '',
  })

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
      setOrg(orgData)

      // Get questionnaires
      const { data: questionnairesData } = await supabase
        .from('questionnaires')
        .select('*')
        .eq('organization_id', orgData.id)
        .order('created_at', { ascending: false })

      if (questionnairesData) {
        setQuestionnaires(questionnairesData)
      }

      // Get assigned approaches with questionnaires
      const { data: orgApproaches } = await supabase
        .from('organization_approaches')
        .select('approach_id')
        .eq('organization_id', orgData.id)

      if (orgApproaches && orgApproaches.length > 0) {
        const approachIds = orgApproaches.map(oa => oa.approach_id)

        const { data: approachesData } = await supabase
          .from('approaches')
          .select('*')
          .in('id', approachIds)
          .eq('is_active', true)

        if (approachesData) {
          // Load questionnaire for each approach (1-to-1 relationship)
          const approachesWithQuestionnaires = await Promise.all(
            approachesData.map(async (approach) => {
              const { data: questionnaire } = await supabase
                .from('approach_questionnaires')
                .select('*')
                .eq('approach_id', approach.id)
                .maybeSingle()

              return {
                ...approach,
                questionnaire: questionnaire || null
              }
            })
          )

          setApproaches(approachesWithQuestionnaires)
        }
      }
    }

    setLoading(false)
  }, [slug])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function createQuestionnaire(e: React.FormEvent) {
    e.preventDefault()
    if (!org || !selectedApproach || !selectedApproach.questionnaire) return

    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    const { error } = await supabase
      .from('questionnaires')
      .insert([{
        organization_id: org.id,
        approach_questionnaire_id: selectedApproach.questionnaire.id,
        title: newQuestionnaire.title,
        description: newQuestionnaire.description || null,
        schema: selectedApproach.questionnaire.schema,
        is_anonymous: newQuestionnaire.is_anonymous,
        start_date: newQuestionnaire.start_date || null,
        end_date: newQuestionnaire.end_date || null,
        status: 'draft',
      }])

    if (!error) {
      setShowCreateForm(false)
      setSelectedApproach(null)
      setNewQuestionnaire({
        title: '',
        description: '',
        is_anonymous: false,
        start_date: '',
        end_date: '',
      })
      loadData()
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!org) {
    return <div className="p-6">Organization not found</div>
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center mb-6">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">Questionnaires</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage questionnaires for {org.name}
          </p>
        </div>
      </div>

      {/* Available Approaches */}
      {approaches.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Available Approaches</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {approaches.map((approach) => (
              <div key={approach.id} className="bg-white shadow rounded-lg p-6">
                <h3 className="text-base font-medium text-gray-900">{approach.name}</h3>
                {approach.description && (
                  <p className="mt-2 text-sm text-gray-600">{approach.description}</p>
                )}
                {approach.category && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                    {approach.category}
                  </span>
                )}
                <div className="mt-4">
                  {approach.questionnaire ? (
                    <button
                      onClick={() => {
                        setSelectedApproach(approach)
                        setNewQuestionnaire({
                          ...newQuestionnaire,
                          title: approach.questionnaire!.title,
                          description: approach.questionnaire!.description || '',
                        })
                        setShowCreateForm(true)
                      }}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      Create from this approach
                    </button>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      No questionnaire available for this approach yet
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Questionnaire Form Modal */}
      {showCreateForm && selectedApproach && selectedApproach.questionnaire && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-medium mb-4">Create Questionnaire from Approach</h2>
            <p className="text-sm text-gray-600 mb-4">
              Approach: <span className="font-medium">{selectedApproach.name}</span>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Questionnaire: <span className="font-medium">{selectedApproach.questionnaire.title}</span>
            </p>
            <form onSubmit={createQuestionnaire} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  required
                  value={newQuestionnaire.title}
                  onChange={(e) => setNewQuestionnaire({ ...newQuestionnaire, title: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={newQuestionnaire.description}
                  onChange={(e) => setNewQuestionnaire({ ...newQuestionnaire, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_anonymous"
                  checked={newQuestionnaire.is_anonymous}
                  onChange={(e) => setNewQuestionnaire({ ...newQuestionnaire, is_anonymous: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_anonymous" className="ml-2 block text-sm text-gray-900">
                  Anonymous responses
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Date</label>
                  <input
                    type="date"
                    value={newQuestionnaire.start_date}
                    onChange={(e) => setNewQuestionnaire({ ...newQuestionnaire, start_date: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Date</label>
                  <input
                    type="date"
                    value={newQuestionnaire.end_date}
                    onChange={(e) => setNewQuestionnaire({ ...newQuestionnaire, end_date: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setSelectedApproach(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Create Questionnaire
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Existing Questionnaires */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Your Questionnaires</h2>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {questionnaires.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {questionnaires.map((q) => (
                <li key={q.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900">
                        {q.title}
                      </h3>
                      {q.description && (
                        <p className="mt-1 text-sm text-gray-500">
                          {q.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center space-x-4 flex-wrap gap-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            q.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : q.status === 'draft'
                              ? 'bg-gray-100 text-gray-800'
                              : q.status === 'closed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {q.status}
                        </span>
                        {q.is_anonymous && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <Users className="h-3 w-3" />
                            Anonymous
                          </span>
                        )}
                        {q.start_date && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            {new Date(q.start_date).toLocaleDateString()}
                            {q.end_date && ` - ${new Date(q.end_date).toLocaleDateString()}`}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          Created {new Date(q.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={() => router.push(`/app/org/${slug}/questionnaires/${q.id}`)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12">
              <Plus className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No questionnaires
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {approaches.length > 0
                  ? 'Select a template from the approaches above to create your first questionnaire.'
                  : 'No approaches have been assigned to this organization yet.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

