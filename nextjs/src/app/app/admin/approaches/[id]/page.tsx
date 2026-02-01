'use client'

import { useEffect, useState } from 'react'
import { createSPASassClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/types'
import { Plus, ArrowLeft, Trash2, FileText, BarChart3, Edit2 } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type Approach = Tables<'approaches'>
type ApproachQuestionnaire = Tables<'approach_questionnaires'>
type ApproachReportTemplate = Tables<'approach_report_templates'>

export default function ApproachDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [approach, setApproach] = useState<Approach | null>(null)
  const [questionnaire, setQuestionnaire] = useState<ApproachQuestionnaire | null>(null)
  const [reportTemplates, setReportTemplates] = useState<ApproachReportTemplate[]>([])
  const [loading, setLoading] = useState(true)
  
  const [showQuestionnaireForm, setShowQuestionnaireForm] = useState(false)
  const [questionnaireForm, setQuestionnaireForm] = useState({
    title: '',
    description: '',
  })

  const [showReportForm, setShowReportForm] = useState(false)
  const [reportForm, setReportForm] = useState({
    name: '',
    slug: '',
    description: '',
    type: 'visualization',
    order: 0,
  })

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
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

    const { data: questionnaireData } = await supabase
      .from('approach_questionnaires')
      .select('*')
      .eq('approach_id', id)
      .maybeSingle()

    if (questionnaireData) {
      setQuestionnaire(questionnaireData)
    }

    const { data: reportsData } = await supabase
      .from('approach_report_templates')
      .select('*')
      .eq('approach_id', id)
      .order('order', { ascending: true })

    if (reportsData) {
      setReportTemplates(reportsData)
    }

    setLoading(false)
  }

  async function createOrUpdateQuestionnaire(e: React.FormEvent) {
    e.preventDefault()
    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    if (questionnaire) {
      const { error } = await supabase
        .from('approach_questionnaires')
        .update({
          title: questionnaireForm.title,
          description: questionnaireForm.description || null,
        })
        .eq('id', questionnaire.id)

      if (!error) {
        setShowQuestionnaireForm(false)
        loadData()
      }
    } else {
      const { error } = await supabase
        .from('approach_questionnaires')
        .insert([{
          approach_id: id,
          title: questionnaireForm.title,
          description: questionnaireForm.description || null,
          schema: {},
        }])

      if (!error) {
        setShowQuestionnaireForm(false)
        setQuestionnaireForm({ title: '', description: '' })
        loadData()
      }
    }
  }

  async function createReportTemplate(e: React.FormEvent) {
    e.preventDefault()
    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    const { error } = await supabase
      .from('approach_report_templates')
      .insert([{
        approach_id: id,
        name: reportForm.name,
        slug: reportForm.slug,
        description: reportForm.description || null,
        type: reportForm.type,
        order: reportForm.order,
        config: {},
      }])

    if (!error) {
      setShowReportForm(false)
      setReportForm({ name: '', slug: '', description: '', type: 'visualization', order: 0 })
      loadData()
    }
  }

  async function deleteReportTemplate(reportId: string) {
    if (!confirm('Are you sure you want to delete this report template?')) return

    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    await supabase
      .from('approach_report_templates')
      .delete()
      .eq('id', reportId)

    loadData()
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
              Questionnaire
            </h3>
          </div>
          {questionnaire ? (
            <Link
              href={`/app/admin/approaches/${id}/questionnaire/edit`}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <Edit2 className="h-4 w-4" />
              Edit Questions
            </Link>
          ) : (
            <button
              onClick={() => setShowQuestionnaireForm(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create Questionnaire
            </button>
          )}
        </div>
        <div className="px-4 py-5 sm:px-6">
          {questionnaire ? (
            <div>
              <h4 className="text-base font-medium text-gray-900">{questionnaire.title}</h4>
              {questionnaire.description && (
                <p className="mt-2 text-sm text-gray-600">{questionnaire.description}</p>
              )}
              <p className="mt-3 text-xs text-gray-500">
                Created: {new Date(questionnaire.created_at).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No questionnaire created yet. Create one to define the survey questions for this approach.
            </p>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Report Templates
            </h3>
          </div>
          <button
            onClick={() => setShowReportForm(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Report Template
          </button>
        </div>
        <div className="px-4 py-5 sm:px-6">
          {reportTemplates.length > 0 ? (
            <div className="space-y-3">
              {reportTemplates.map((report) => (
                <div
                  key={report.id}
                  className="flex items-start justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                        {report.order}
                      </span>
                      <h4 className="text-sm font-medium text-gray-900">{report.name}</h4>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-800">
                        {report.type}
                      </span>
                      {!report.is_active && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Inactive
                        </span>
                      )}
                    </div>
                    {report.description && (
                      <p className="mt-1 text-sm text-gray-600 ml-8">{report.description}</p>
                    )}
                    <p className="mt-2 text-xs text-gray-500 ml-8">
                      Slug: {report.slug}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteReportTemplate(report.id)}
                    className="ml-4 inline-flex items-center gap-1 px-2 py-1 text-sm text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No report templates yet. Add report templates to define how data will be visualized.
            </p>
          )}
        </div>
      </div>

      {showQuestionnaireForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-medium mb-4">
              {questionnaire ? 'Edit Questionnaire' : 'Create Questionnaire'}
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
                  {questionnaire ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReportForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-medium mb-4">Add Report Template</h2>
            <form onSubmit={createReportTemplate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  value={reportForm.name}
                  onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., Laloux Flower"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Slug</label>
                <input
                  type="text"
                  required
                  value={reportForm.slug}
                  onChange={(e) => setReportForm({ ...reportForm, slug: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., laloux-flower"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={reportForm.description}
                  onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                  rows={2}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={reportForm.type}
                  onChange={(e) => setReportForm({ ...reportForm, type: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="visualization">Visualization</option>
                  <option value="pdf">PDF Report</option>
                  <option value="dashboard">Dashboard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Order</label>
                <input
                  type="number"
                  value={reportForm.order}
                  onChange={(e) => setReportForm({ ...reportForm, order: parseInt(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowReportForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
