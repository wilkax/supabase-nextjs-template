import { createSSRClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Tables } from '@/lib/types'
import { isOrgAdmin } from '@/lib/auth/roles'
import InviteAuditorForm from '@/components/InviteAuditorForm'

export default async function MembersPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createSSRClient()

  // Get organization
  const { data: orgData } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!orgData) return null

  const org = orgData as Tables<'organizations'>

  // Check if user is org admin
  const userIsOrgAdmin = await isOrgAdmin(supabase, org.id)

  // Get organization members
  const adminClient = createAdminClient()
  const { data: membersData } = await adminClient
    .from('organization_members')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  // Fetch user emails for each member
  const members = membersData
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

  // Filter members by role
  const admins = members.filter((m) => m.role === 'admin')
  const auditors = members.filter((m) => m.role === 'auditor')

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center mb-6">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
          <p className="mt-2 text-sm text-gray-700">
            All administrators and auditors for {org.name}
          </p>
        </div>
        {userIsOrgAdmin && (
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <InviteAuditorForm organizationId={org.id} />
          </div>
        )}
      </div>

      {/* Admins Section */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Administrators ({admins.length})
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Organization administrators have full access to manage the organization
          </p>
        </div>
        <ul className="divide-y divide-gray-200">
          {admins.length > 0 ? (
            admins.map((member) => (
              <li key={member.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.user?.email || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Admin
                      </span>
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    Added {new Date(member.created_at).toLocaleDateString()}
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
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Auditors ({auditors.length})
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Auditors can view and analyze questionnaire data
          </p>
        </div>
        <ul className="divide-y divide-gray-200">
          {auditors.length > 0 ? (
            auditors.map((member) => (
              <li key={member.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.user?.email || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Auditor
                      </span>
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    Added {new Date(member.created_at).toLocaleDateString()}
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
    </div>
  )
}

