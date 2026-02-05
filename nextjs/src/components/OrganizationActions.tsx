'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { archiveOrganization, unarchiveOrganization, deleteOrganization } from '@/app/[locale]/actions/organizations'

interface OrganizationActionsProps {
  organizationId: string
  organizationName: string
  isArchived: boolean
}

export default function OrganizationActions({
  organizationId,
  organizationName,
  isArchived,
}: OrganizationActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleArchive() {
    if (!confirm(`Are you sure you want to archive "${organizationName}"? It will be hidden from the main list.`)) {
      return
    }

    setLoading(true)
    const result = await archiveOrganization(organizationId)
    setLoading(false)

    if (result.success) {
      alert('Organization archived successfully')
      router.refresh()
    } else {
      alert(result.error || 'Failed to archive organization')
    }
  }

  async function handleUnarchive() {
    setLoading(true)
    const result = await unarchiveOrganization(organizationId)
    setLoading(false)

    if (result.success) {
      alert('Organization unarchived successfully')
      router.refresh()
    } else {
      alert(result.error || 'Failed to unarchive organization')
    }
  }

  async function handleDelete() {
    const confirmName = prompt(
      `This will permanently delete "${organizationName}" and all associated data.\n\nType the organization name to confirm:`
    )

    if (confirmName !== organizationName) {
      if (confirmName !== null) {
        alert('Organization name does not match. Deletion cancelled.')
      }
      return
    }

    setLoading(true)
    const result = await deleteOrganization(organizationId)
    setLoading(false)

    if (result.success) {
      const counts = result.counts
      const message = counts
        ? `Organization deleted successfully.\n\nDeleted:\n- ${counts.members} member(s)\n- ${counts.questionnaires} questionnaire(s)\n- ${counts.responses} response(s)`
        : 'Organization deleted successfully'
      
      alert(message)
      router.push('/app/admin/organizations')
    } else {
      alert(result.error || 'Failed to delete organization')
    }
  }

  return (
    <div className="bg-white shadow rounded-lg p-6 border-2 border-red-200">
      <h2 className="text-lg font-medium text-red-900 mb-2">Danger Zone</h2>
      <p className="text-sm text-gray-600 mb-4">
        Manage archiving and deletion of this organization.
      </p>
      <div className="flex flex-wrap gap-3">
        {!isArchived ? (
          <button
            onClick={handleArchive}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <Archive className="h-4 w-4" />
            Archive Organization
          </button>
        ) : (
          <button
            onClick={handleUnarchive}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-blue-300 text-sm font-medium rounded-md shadow-sm text-blue-700 bg-white hover:bg-blue-50 disabled:opacity-50"
          >
            <ArchiveRestore className="h-4 w-4" />
            Unarchive Organization
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete Organization
        </button>
      </div>
    </div>
  )
}

