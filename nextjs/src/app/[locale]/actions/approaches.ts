'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/auth/roles'

/**
 * Delete an approach and all associated data
 * Returns the count of organizations using this approach
 */
export async function deleteApproach(
  approachId: string
): Promise<{ success: boolean; error?: string; organizationCount?: number }> {
  try {
    const supabase = await createSSRClient()

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(supabase)

    if (!isAdmin) {
      return {
        success: false,
        error: 'Unauthorized: Only system admins can delete approaches',
      }
    }

    // Get approach to verify it exists
    const { data: approach, error: aError } = await supabase
      .from('approaches')
      .select('*')
      .eq('id', approachId)
      .single()

    if (aError || !approach) {
      return {
        success: false,
        error: 'Approach not found',
      }
    }

    // Count organizations using this approach
    const { count: orgCount } = await supabase
      .from('organization_approaches')
      .select('*', { count: 'exact', head: true })
      .eq('approach_id', approachId)

    // Delete the approach (CASCADE will handle related data)
    const { error: deleteError } = await supabase
      .from('approaches')
      .delete()
      .eq('id', approachId)

    if (deleteError) {
      return {
        success: false,
        error: 'Failed to delete approach: ' + deleteError.message,
      }
    }

    return {
      success: true,
      organizationCount: orgCount || 0,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

