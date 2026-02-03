'use server'

import { inviteOrgAdmin, inviteOrgAuditor } from '@/lib/auth/invites'
import { createSSRClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSystemAdmin, isOrgAdmin } from '@/lib/auth/roles'

/**
 * Server action to invite an organization admin
 * Only system admins can call this
 */
export async function inviteOrganizationAdmin(
  organizationId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSSRClient()

    // Check if user is system admin
    const isSysAdmin = await isSystemAdmin(supabase)
    if (!isSysAdmin) {
      return { success: false, error: 'Unauthorized: Only system admins can invite organization admins' }
    }

    // Invite the user
    return await inviteOrgAdmin(email, organizationId)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Server action to invite an organization auditor
 * System admins and org admins can call this
 */
export async function inviteOrganizationAuditor(
  organizationId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSSRClient()

    // Check if user is system admin or org admin
    const isSysAdmin = await isSystemAdmin(supabase)
    const isOrgAdm = await isOrgAdmin(supabase, organizationId)

    if (!isSysAdmin && !isOrgAdm) {
      return {
        success: false,
        error: 'Unauthorized: Only system admins or organization admins can invite auditors',
      }
    }

    // Invite the user
    return await inviteOrgAuditor(email, organizationId)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Server action to remove an organization member
 * Only system admins can call this
 */
export async function removeOrganizationMember(
  memberId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSSRClient()

    // Check if user is system admin
    const isSysAdmin = await isSystemAdmin(supabase)
    if (!isSysAdmin) {
      return {
        success: false,
        error: 'Unauthorized: Only system admins can remove organization members',
      }
    }

    // Use admin client to delete the member
    const adminClient = createAdminClient()
    const { error } = await adminClient
      .from('organization_members')
      .delete()
      .eq('id', memberId)
      .eq('organization_id', organizationId)

    if (error) {
      return {
        success: false,
        error: error.message,
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

