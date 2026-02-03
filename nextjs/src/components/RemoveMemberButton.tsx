'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { removeOrganizationMember } from '@/app/actions/invites'
import { Trash2, X } from 'lucide-react'

interface RemoveMemberButtonProps {
  memberId: string
  organizationId: string
  memberEmail: string
  memberRole: string
}

export default function RemoveMemberButton({
  memberId,
  organizationId,
  memberEmail,
  memberRole,
}: RemoveMemberButtonProps) {
  const router = useRouter()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRemove = async () => {
    setError('')
    setLoading(true)

    try {
      const result = await removeOrganizationMember(memberId, organizationId)

      if (result.success) {
        setIsConfirmOpen(false)
        router.refresh() // Refresh the page to update the member list
      } else {
        setError(result.error || 'Failed to remove member')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsConfirmOpen(true)}
        className="text-red-600 hover:text-red-700 p-1"
        title="Remove member"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {isConfirmOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                Remove Member
              </h3>
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {error && (
                <div className="mb-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg">
                  {error}
                </div>
              )}

              <p className="text-sm text-gray-700 mb-4">
                Are you sure you want to remove{' '}
                <span className="font-semibold">{memberEmail}</span> (
                {memberRole}) from this organization?
              </p>

              <p className="text-sm text-gray-500 mb-6">
                This action cannot be undone. The user will lose access to all
                organization resources.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsConfirmOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemove}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Removing...' : 'Remove Member'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

