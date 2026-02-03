import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Invite a user to be an organization admin
 * This will:
 * 1. Send an invitation email via Supabase Auth
 * 2. Create a pending organization_members record
 */
export async function inviteOrgAdmin(
  email: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    // Send invite via Supabase Auth
    const { data: inviteData, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
      })

    if (inviteError) {
      return { success: false, error: inviteError.message }
    }

    if (!inviteData.user) {
      return { success: false, error: 'Failed to create user invitation' }
    }

    // Create organization membership record
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        user_id: inviteData.user.id,
        organization_id: organizationId,
        role: 'admin',
      })

    if (memberError) {
      return { success: false, error: memberError.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Invite a user to be an organization auditor
 * This will:
 * 1. Send an invitation email via Supabase Auth
 * 2. Create a pending organization_members record
 */
export async function inviteOrgAuditor(
  email: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    // Send invite via Supabase Auth
    const { data: inviteData, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
      })

    if (inviteError) {
      return { success: false, error: inviteError.message }
    }

    if (!inviteData.user) {
      return { success: false, error: 'Failed to create user invitation' }
    }

    // Create organization membership record
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        user_id: inviteData.user.id,
        organization_id: organizationId,
        role: 'auditor',
      })

    if (memberError) {
      return { success: false, error: memberError.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

