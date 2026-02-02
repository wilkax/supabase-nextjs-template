import { Database } from '@/lib/types'
import { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = Database['public']['Enums']['user_role_type']
export type OrgMemberRole = Database['public']['Enums']['org_member_role']

export interface UserRoleInfo {
  isSystemAdmin: boolean
  organizationMemberships: Array<{
    organizationId: string
    organizationSlug: string
    role: OrgMemberRole
  }>
}

/**
 * Get all roles and organization memberships for the current user
 */
export async function getUserRoles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<UserRoleInfo> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      isSystemAdmin: false,
      organizationMemberships: [],
    }
  }

  // Check if user is system admin
  const { data: systemAdminRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'system_admin')
    .maybeSingle()

  const isSystemAdmin = !!systemAdminRole

  // Get organization memberships
  const { data: membershipsData } = await supabase
    .from('organization_members')
    .select(
      `
      organization_id,
      role,
      organizations (
        slug
      )
    `
    )
    .eq('user_id', user.id)

  type MembershipWithOrg = {
    organization_id: string
    role: OrgMemberRole
    organizations: { slug: string } | null
  }

  const memberships = (membershipsData || []) as unknown as MembershipWithOrg[]

  const organizationMemberships =
    memberships.map((m: MembershipWithOrg) => ({
      organizationId: m.organization_id,
      organizationSlug: m.organizations?.slug || '',
      role: m.role as OrgMemberRole,
    }))

  return {
    isSystemAdmin,
    organizationMemberships,
  }
}

/**
 * Check if the current user is a system admin
 */
export async function isSystemAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<boolean> {
  const { data } = await supabase.rpc('is_system_admin')
  return data || false
}

/**
 * Check if the current user is an admin of a specific organization
 */
export async function isOrgAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string
): Promise<boolean> {
  const { data } = await supabase.rpc('is_org_admin', { org_id: orgId })
  return data || false
}

/**
 * Check if the current user is a member (admin or auditor) of a specific organization
 */
export async function isOrgMember(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string
): Promise<boolean> {
  const { data } = await supabase.rpc('is_org_member', { org_id: orgId })
  return data || false
}

/**
 * Get the user's role in a specific organization
 */
export async function getUserOrgRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string
): Promise<OrgMemberRole | null> {
  const { data } = await supabase.rpc('get_user_org_role', { org_id: orgId })
  return data || null
}

/**
 * Check if user has access to admin area (system admin only)
 */
export async function canAccessAdminArea(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<boolean> {
  return isSystemAdmin(supabase)
}

/**
 * Check if user has access to organization area (system admin or org member)
 */
export async function canAccessOrgArea(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string
): Promise<boolean> {
  const [isSysAdmin, isOrgMem] = await Promise.all([
    isSystemAdmin(supabase),
    isOrgMember(supabase, orgId),
  ])
  return isSysAdmin || isOrgMem
}

/**
 * Check if user can manage organization (system admin or org admin)
 */
export async function canManageOrg(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string
): Promise<boolean> {
  const [isSysAdmin, isOrgAdm] = await Promise.all([
    isSystemAdmin(supabase),
    isOrgAdmin(supabase, orgId),
  ])
  return isSysAdmin || isOrgAdm
}

