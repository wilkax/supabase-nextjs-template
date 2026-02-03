import { createSSRClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import InviteAdminForm from '@/components/InviteAdminForm'
import InviteAuditorForm from '@/components/InviteAuditorForm'
import RemoveMemberButton from '@/components/RemoveMemberButton'
import { Tables } from '@/lib/types'

// Disable caching for this page to always show fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSSRClient()

  // Get organization details
  const { data: orgData, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !orgData) {
    return notFound()
  }

  const org = orgData as Tables<'organizations'>

  // Get organization members with user emails
  const adminClient = createAdminClient()
  const { data: membersData } = await adminClient
    .from('organization_members')
    .select('*')
    .eq('organization_id', id)

  // Fetch user emails for each member
  type MemberWithUser = Tables<'organization_members'> & {
    user: { email: string }
  }

  const members: MemberWithUser[] = membersData
    ? await Promise.all(
        membersData.map(async (member) => {
          const { data: userData } = await adminClient.auth.admin.getUserById(
            member.user_id
          )
          return {
            ...member,
            user: { email: userData.user?.email || 'Unknown' },
          }
        })
      )
    : []

  // Separate members by role
  const admins = members.filter((m) => m.role === 'admin')
  const auditors = members.filter((m) => m.role === 'auditor')

  // Get questionnaires
  const { data: questionnairesData } = await supabase
    .from('questionnaires')
    .select('*')
    .eq('organization_id', id)
    .order('created_at', { ascending: false })

  const questionnaires = (questionnairesData || []) as Tables<'questionnaires'>[]

  // Get participants
  const { data: participantsData } = await supabase
    .from('participants')
    .select('*')
    .eq('organization_id', id)
    .order('created_at', { ascending: false })

  const participants = (participantsData || []) as Tables<'participants'>[]

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/organizations"
          className="text-sm text-blue-600 hover:text-blue-500 mb-2 inline-block"
        >
          ← Back to Organizations
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
        <p className="mt-1 text-sm text-gray-500">/{org.slug}</p>
        {org.description && (
          <p className="mt-2 text-sm text-gray-700">{org.description}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="text-sm font-medium text-gray-500">Members</div>
            <div className="mt-1 text-3xl font-semibold text-gray-900">
              {members?.length || 0}
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="text-sm font-medium text-gray-500">
              Questionnaires
            </div>
            <div className="mt-1 text-3xl font-semibold text-gray-900">
              {questionnaires?.length || 0}
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="text-sm font-medium text-gray-500">
              Participants
            </div>
            <div className="mt-1 text-3xl font-semibold text-gray-900">
              {participants?.length || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Administrators Section */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Administrators ({admins.length})
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Organization administrators have full access to manage the
              organization
            </p>
          </div>
          <InviteAdminForm organizationId={id} />
        </div>
        <ul className="divide-y divide-gray-200">
          {admins.length > 0 ? (
            admins.map((member) => (
              <li key={member.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {member.user?.email || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Admin
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-500">
                      Added {new Date(member.created_at).toLocaleDateString()}
                    </div>
                    <RemoveMemberButton
                      memberId={member.id}
                      organizationId={id}
                      memberEmail={member.user?.email || 'Unknown'}
                      memberRole="Admin"
                    />
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="px-4 py-4 sm:px-6 text-sm text-gray-500">
              No administrators
            </li>
          )}
        </ul>
      </div>

      {/* Auditors Section */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Auditors ({auditors.length})
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Auditors can view and analyze questionnaire data
            </p>
          </div>
          <InviteAuditorForm organizationId={id} />
        </div>
        <ul className="divide-y divide-gray-200">
          {auditors.length > 0 ? (
            auditors.map((member) => (
              <li key={member.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {member.user?.email || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Auditor
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-500">
                      Added {new Date(member.created_at).toLocaleDateString()}
                    </div>
                    <RemoveMemberButton
                      memberId={member.id}
                      organizationId={id}
                      memberEmail={member.user?.email || 'Unknown'}
                      memberRole="Auditor"
                    />
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="px-4 py-4 sm:px-6 text-sm text-gray-500">
              No auditors
            </li>
          )}
        </ul>
      </div>

      {/* Questionnaires Section */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Questionnaires
          </h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {questionnaires && questionnaires.length > 0 ? (
            questionnaires.map((q) => (
              <li key={q.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {q.title}
                    </p>
                    <p className="text-sm text-gray-500">Status: {q.status}</p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(q.created_at).toLocaleDateString()}
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="px-4 py-4 sm:px-6 text-sm text-gray-500">
              No questionnaires yet
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

