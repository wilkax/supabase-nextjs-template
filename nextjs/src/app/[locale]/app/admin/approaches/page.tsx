'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createSPASassClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/types'
import { Plus, FileText, Layers, X, Search } from 'lucide-react'
import Link from 'next/link'

type Approach = Tables<'approaches'>

export default function ApproachesPage() {
  const t = useTranslations('approaches')
  const c = useTranslations('common')
  const [approaches, setApproaches] = useState<Approach[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newApproach, setNewApproach] = useState({
    name: '',
    slug: '',
    description: '',
    categories: [] as string[],
  })
  const [categoryInput, setCategoryInput] = useState('')

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [allCategories, setAllCategories] = useState<string[]>([])

  useEffect(() => {
    loadApproaches()
  }, [])

  async function loadApproaches() {
    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    const { data } = await supabase
      .from('approaches')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) {
      setApproaches(data)

      // Extract all unique categories
      const categories = new Set<string>()
      data.forEach(approach => {
        if (approach.category && Array.isArray(approach.category)) {
          approach.category.forEach(cat => categories.add(cat))
        }
      })
      setAllCategories(Array.from(categories).sort())
    }
    setLoading(false)
  }

  async function createApproach(e: React.FormEvent) {
    e.preventDefault()
    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    const { error } = await supabase
      .from('approaches')
      .insert([{
        name: newApproach.name,
        slug: newApproach.slug,
        description: newApproach.description || null,
        category: newApproach.categories.length > 0 ? newApproach.categories : null,
      }])

    if (!error) {
      setShowCreateForm(false)
      setNewApproach({ name: '', slug: '', description: '', categories: [] })
      setCategoryInput('')
      loadApproaches()
    }
  }

  function addCategory() {
    const trimmed = categoryInput.trim()
    if (trimmed && !newApproach.categories.includes(trimmed)) {
      setNewApproach({ ...newApproach, categories: [...newApproach.categories, trimmed] })
      setCategoryInput('')
    }
  }

  function removeCategory(category: string) {
    setNewApproach({
      ...newApproach,
      categories: newApproach.categories.filter(c => c !== category)
    })
  }

  function handleCategoryKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCategory()
    }
  }

  async function toggleActive(id: string, currentStatus: boolean) {
    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    await supabase
      .from('approaches')
      .update({ is_active: !currentStatus })
      .eq('id', id)

    loadApproaches()
  }

  function toggleCategoryFilter(category: string) {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  // Filter approaches based on search query and selected categories
  const filteredApproaches = approaches.filter(approach => {
    const matchesSearch = searchQuery === '' ||
      approach.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      approach.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      approach.slug.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = selectedCategories.length === 0 ||
      (approach.category && approach.category.some(cat => selectedCategories.includes(cat)))

    return matchesSearch && matchesCategory
  })

  if (loading) {
    return <div className="p-6">{t('loading')}</div>
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center mb-6">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="mt-2 text-sm text-gray-700">
            {t('description')}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {t('createApproach')}
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="mb-6 bg-white shadow rounded-lg p-4">
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, description, or slug..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Category Filters */}
          {allCategories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Category
              </label>
              <div className="flex flex-wrap gap-2">
                {allCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategoryFilter(category)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedCategories.includes(category)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
                {selectedCategories.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategories([])}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Results Count */}
          <div className="text-sm text-gray-500">
            Showing {filteredApproaches.length} of {approaches.length} approaches
          </div>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-medium mb-4">{t('createApproach')}</h2>
            <form onSubmit={createApproach} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{c('name')}</label>
                <input
                  type="text"
                  required
                  value={newApproach.name}
                  onChange={(e) => setNewApproach({ ...newApproach, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{c('slug')}</label>
                <input
                  type="text"
                  required
                  value={newApproach.slug}
                  onChange={(e) => setNewApproach({ ...newApproach, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{c('category')}</label>
                <div className="mt-1">
                  {/* Display existing category tags */}
                  {newApproach.categories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {newApproach.categories.map((cat) => (
                        <span
                          key={cat}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {cat}
                          <button
                            type="button"
                            onClick={() => removeCategory(cat)}
                            className="hover:text-blue-900"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Input for adding new categories */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={categoryInput}
                      onChange={(e) => setCategoryInput(e.target.value)}
                      onKeyDown={handleCategoryKeyDown}
                      placeholder="Add category and press Enter"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={addCategory}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-300 rounded-md hover:bg-blue-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{c('description')}</label>
                <textarea
                  value={newApproach.description}
                  onChange={(e) => setNewApproach({ ...newApproach, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  {c('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  {c('create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approaches List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {filteredApproaches.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredApproaches.map((approach) => (
              <div key={approach.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        {approach.name}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          approach.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {approach.is_active ? t('active') : t('inactive')}
                      </span>
                      {approach.category && approach.category.length > 0 && (
                        <>
                          {approach.category.map((cat) => (
                            <span
                              key={cat}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {cat}
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                    {approach.description && (
                      <p className="mt-2 text-sm text-gray-600">
                        {approach.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                      <span>Slug: {approach.slug}</span>
                      <span>{ t('created') } {new Date(approach.created_at).toLocaleDateString(c('locale'))}</span>
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <Link
                      href={`/app/admin/approaches/${approach.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      <FileText className="h-4 w-4" />
                      {t('templates')}
                    </Link>
                    <button
                      onClick={() => toggleActive(approach.id, approach.is_active)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                        approach.is_active
                          ? 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                          : 'text-green-700 bg-green-100 hover:bg-green-200'
                      }`}
                    >
                      {approach.is_active ? t('deactivate') : t('activate')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Layers className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {c('noApproaches')}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {c('getStartedApproach')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

