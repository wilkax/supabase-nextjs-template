'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { canManageOrg } from '@/lib/auth/roles'
import { Tables } from '@/lib/types'

/**
 * Generate an anonymous invitation link for a questionnaire
 * Creates a generic participant and access token for anonymous access
 */
export async function generateAnonymousInviteLink(
  questionnaireId: string,
  organizationId: string
): Promise<{ success: boolean; link?: string; error?: string }> {
  try {
    const supabase = await createSSRClient()

    // Check if user can manage the organization (system admin or org admin)
    const canManage = await canManageOrg(supabase, organizationId)

    if (!canManage) {
      return {
        success: false,
        error: 'Unauthorized: Only organization admins and system admins can generate invite links',
      }
    }

    // Get questionnaire to verify it exists and belongs to the org
    const { data: questionnaire, error: qError } = await supabase
      .from('questionnaires')
      .select('*')
      .eq('id', questionnaireId)
      .eq('organization_id', organizationId)
      .single()

    if (qError || !questionnaire) {
      return {
        success: false,
        error: 'Questionnaire not found',
      }
    }

    // Type assertion for questionnaire
    const typedQuestionnaire = questionnaire as Tables<'questionnaires'>

    // Check if questionnaire is anonymous
    if (!typedQuestionnaire.is_anonymous) {
      return {
        success: false,
        error: 'This questionnaire is not configured for anonymous responses',
      }
    }

    // Create a generic anonymous participant for this questionnaire
    const { data: participant, error: pError } = await (supabase as any)
      .from('participants')
      .insert({
        organization_id: organizationId,
        email: `anonymous-${Date.now()}@questionnaire.local`,
        name: 'Anonymous Participant',
        metadata: { type: 'anonymous', questionnaire_id: questionnaireId },
      })
      .select()
      .single()

    if (pError || !participant) {
      return {
        success: false,
        error: 'Failed to create participant',
      }
    }

    // Type assertion for participant
    const typedParticipant = participant as Tables<'participants'>

    // Generate a secure token
    const tokenBytes = new Uint8Array(32)
    crypto.getRandomValues(tokenBytes)
    const token = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Create access token with expiration based on questionnaire end_date
    const expiresAt = typedQuestionnaire.end_date
      ? new Date(typedQuestionnaire.end_date)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days default

    const { error: tokenError } = await (supabase as any)
      .from('participant_access_tokens')
      .insert({
        participant_id: typedParticipant.id,
        questionnaire_id: questionnaireId,
        token: token,
        expires_at: expiresAt.toISOString(),
      })

    if (tokenError) {
      return {
        success: false,
        error: 'Failed to create access token',
      }
    }

    // Generate the invitation link
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const inviteLink = `${baseUrl}/q/${token}`

    return {
      success: true,
      link: inviteLink,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get existing invitation link for a questionnaire
 * Returns the most recent valid token for the questionnaire
 */
export async function getQuestionnaireInviteLink(
  questionnaireId: string,
  organizationId: string
): Promise<{ success: boolean; link?: string; error?: string }> {
  try {
    const supabase = await createSSRClient()

    // Check if user can manage the organization (system admin or org admin)
    const canManage = await canManageOrg(supabase, organizationId)

    if (!canManage) {
      return {
        success: false,
        error: 'Unauthorized: Only organization admins and system admins can view invite links',
      }
    }

    // Get the most recent token for this questionnaire
    const { data: token, error } = await supabase
      .from('participant_access_tokens')
      .select('token')
      .eq('questionnaire_id', questionnaireId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return {
        success: false,
        error: 'Failed to fetch invitation link',
      }
    }

    if (!token) {
      return {
        success: true,
        link: undefined,
      }
    }

    // Generate the invitation link
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const inviteLink = `${baseUrl}/q/${token.token}`

    return {
      success: true,
      link: inviteLink,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Update questionnaire dates
 */
export async function updateQuestionnaireDates(
  questionnaireId: string,
  organizationId: string,
  startDate: string | null,
  endDate: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSSRClient()

    // Check if user can manage the organization (system admin or org admin)
    const canManage = await canManageOrg(supabase, organizationId)

    if (!canManage) {
      return {
        success: false,
        error: 'Unauthorized: Only organization admins and system admins can update questionnaires',
      }
    }

    // Update the questionnaire
    const { error } = await (supabase as any)
      .from('questionnaires')
      .update({
        start_date: startDate,
        end_date: endDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionnaireId)
      .eq('organization_id', organizationId)

    if (error) {
      return {
        success: false,
        error: 'Failed to update questionnaire dates',
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

