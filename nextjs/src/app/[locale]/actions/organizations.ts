'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/auth/roles'

/**
 * Archive an organization (soft delete)
 */
export async function archiveOrganization(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSSRClient()

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(supabase)

    if (!isAdmin) {
      return {
        success: false,
        error: 'Unauthorized: Only system admins can archive organizations',
      }
    }

    // Archive the organization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('organizations')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', organizationId)

    if (error) {
      return {
        success: false,
        error: 'Failed to archive organization: ' + error.message,
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

/**
 * Unarchive an organization
 */
export async function unarchiveOrganization(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSSRClient()

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(supabase)

    if (!isAdmin) {
      return {
        success: false,
        error: 'Unauthorized: Only system admins can unarchive organizations',
      }
    }

    // Unarchive the organization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('organizations')
      .update({ is_archived: false, updated_at: new Date().toISOString() })
      .eq('id', organizationId)

    if (error) {
      return {
        success: false,
        error: 'Failed to unarchive organization: ' + error.message,
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

/**
 * Delete an organization and all associated data
 * Returns counts of related data that will be deleted
 */
export async function deleteOrganization(
  organizationId: string
): Promise<{
  success: boolean
  error?: string
  counts?: {
    members: number
    questionnaires: number
    responses: number
  }
}> {
  try {
    const supabase = await createSSRClient()

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(supabase)

    if (!isAdmin) {
      return {
        success: false,
        error: 'Unauthorized: Only system admins can delete organizations',
      }
    }

    // Get organization to verify it exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: organization, error: orgError } = await (supabase as any)
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single()

    if (orgError || !organization) {
      return {
        success: false,
        error: 'Organization not found',
      }
    }

    // Count related data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: memberCount } = await (supabase as any)
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: questionnaireCount } = await (supabase as any)
      .from('questionnaires')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    // Get questionnaire IDs first, then count responses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: questionnaires } = await (supabase as any)
      .from('questionnaires')
      .select('id')
      .eq('organization_id', organizationId)

    let responseCount = 0
    if (questionnaires && questionnaires.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const questionnaireIds = questionnaires.map((q: any) => q.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (supabase as any)
        .from('questionnaire_responses')
        .select('*', { count: 'exact', head: true })
        .in('questionnaire_id', questionnaireIds)
      responseCount = count || 0
    }

    // Delete the organization (CASCADE will handle related data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('organizations')
      .delete()
      .eq('id', organizationId)

    if (deleteError) {
      return {
        success: false,
        error: 'Failed to delete organization: ' + deleteError.message,
      }
    }

    return {
      success: true,
      counts: {
        members: memberCount || 0,
        questionnaires: questionnaireCount || 0,
        responses: responseCount || 0,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

