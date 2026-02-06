'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createSPASassClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/types'
import { X, Layers, Search } from 'lucide-react'

type Approach = Tables<'approaches'>
type OrganizationApproach = Tables<'organization_approaches'>

interface OrganizationApproachesProps {
  organizationId: string
}

export default function OrganizationApproaches({ organizationId }: OrganizationApproachesProps) {
  const [allApproaches, setAllApproaches] = useState<Approach[]>([])
  const [assignedApproaches, setAssignedApproaches] = useState<OrganizationApproach[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const loadData = useCallback(async () => {
    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    // Load all active approaches
    const { data: approachesData } = await supabase
      .from('approaches')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (approachesData) {
      setAllApproaches(approachesData)
    }

    // Load assigned approaches
    const { data: assignedData } = await supabase
      .from('organization_approaches')
      .select('*')
      .eq('organization_id', organizationId)

    if (assignedData) {
      setAssignedApproaches(assignedData)
    }

    setLoading(false)
  }, [organizationId])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function assignApproach(approachId: string) {
    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    const { error } = await supabase
      .from('organization_approaches')
      .insert([{
        organization_id: organizationId,
        approach_id: approachId,
      }])

    if (!error) {
      loadData()
    }
  }

  async function unassignApproach(approachId: string) {
    if (!confirm('Are you sure you want to unassign this approach?')) return

    const supabaseWrapper = await createSPASassClient()
    const supabase = supabaseWrapper.getSupabaseClient()

    await supabase
      .from('organization_approaches')
      .delete()
      .eq('organization_id', organizationId)
      .eq('approach_id', approachId)

    loadData()
  }

  const assignedApproachIds = assignedApproaches.map(a => a.approach_id)
  const assignedApproachDetails = allApproaches.filter(a => assignedApproachIds.includes(a.id))
  const availableApproaches = allApproaches.filter(a => !assignedApproachIds.includes(a.id))

  // Filter available approaches based on search query
  const filteredAvailableApproaches = availableApproaches.filter(approach => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      approach.name.toLowerCase().includes(query) ||
      approach.description?.toLowerCase().includes(query) ||
      (Array.isArray(approach.category) && approach.category.some(cat => cat.toLowerCase().includes(query)))
    )
  })

  if (loading) {
    return <div className="text-sm text-gray-500">Loading approaches...</div>
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          Assigned Approaches
        </h3>

        {/* Search Input */}
        {availableApproaches.length > 0 && (
          <div className="relative" ref={searchContainerRef}>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowSearchResults(true)
                }}
                onFocus={() => setShowSearchResults(true)}
                placeholder="Search approaches to assign..."
                className="block w-full rounded-md border-0 py-2 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && searchQuery.trim() && (
              <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-96 overflow-y-auto">
                {filteredAvailableApproaches.length > 0 ? (
                  <div className="py-1">
                    {filteredAvailableApproaches.map((approach) => (
                      <button
                        key={approach.id}
                        onClick={() => {
                          assignApproach(approach.id)
                          setSearchQuery('')
                          setShowSearchResults(false)
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-start gap-2">
                          <Layers className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900">{approach.name}</div>
                            {approach.description && (
                              <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {approach.description}
                              </div>
                            )}
                            {approach.category && (
                              <div className="mt-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  {approach.category}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    No approaches found matching &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assigned Approaches List */}
      <div className="px-4 py-5 sm:px-6">
        {assignedApproachDetails.length > 0 ? (
          <div className="space-y-3">
            {assignedApproachDetails.map((approach) => (
              <div
                key={approach.id}
                className="flex items-start justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-gray-400" />
                    <h4 className="text-sm font-medium text-gray-900">
                      {approach.name}
                    </h4>
                    {approach.category && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {approach.category}
                      </span>
                    )}
                  </div>
                  {approach.description && (
                    <p className="mt-1 text-sm text-gray-600 ml-7">
                      {approach.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => unassignApproach(approach.id)}
                  className="ml-4 inline-flex items-center gap-1 px-2 py-1 text-sm text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No approaches assigned yet. Use the search above to assign approaches and enable questionnaire templates for this organization.
          </p>
        )}
      </div>
    </div>
  )
}

