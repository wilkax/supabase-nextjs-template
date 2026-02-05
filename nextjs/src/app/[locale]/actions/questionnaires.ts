'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { canManageOrg } from '@/lib/auth/roles'
import { Tables } from '@/lib/types'

/**
 * Generate an anonymous invitation link for a questionnaire
 * Creates a shared access token that can be used by multiple participants
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

    // Generate a secure token
    const tokenBytes = new Uint8Array(32)
    crypto.getRandomValues(tokenBytes)
    const token = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Create access token with expiration based on questionnaire end_date
    // This is a SHARED token - no participant_id, can be used by multiple people
    // For anonymous questionnaires, only use end_date (no default expiration)
    const expiresAt = typedQuestionnaire.end_date
      ? new Date(typedQuestionnaire.end_date)
      : null // No expiration if no end_date set

    const { error: tokenError } = await (supabase as any)
      .from('participant_access_tokens')
      .insert({
        participant_id: null, // Shared token - no specific participant
        questionnaire_id: questionnaireId,
        token: token,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        is_shared: true, // Mark as shared token
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
    const { data: tokenData, error } = await supabase
      .from('participant_access_tokens')
      .select('token')
      .eq('questionnaire_id', questionnaireId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { token: string } | null; error: any }

    if (error) {
      return {
        success: false,
        error: 'Failed to fetch invitation link',
      }
    }

    if (!tokenData) {
      return {
        success: true,
        link: undefined,
      }
    }

    // Generate the invitation link
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const inviteLink = `${baseUrl}/q/${tokenData.token}`

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

/**
 * Import participants for a named questionnaire
 * Accepts an array of participant data (email, name, metadata)
 */
export async function importParticipants(
  questionnaireId: string,
  organizationId: string,
  participants: Array<{ email: string; name?: string; metadata?: any }>
): Promise<{ success: boolean; imported?: number; error?: string }> {
  try {
    const supabase = await createSSRClient()

    // Check if user can manage the organization
    const canManage = await canManageOrg(supabase, organizationId)

    if (!canManage) {
      return {
        success: false,
        error: 'Unauthorized: Only organization admins and system admins can import participants',
      }
    }

    // Get questionnaire to verify it exists and is NOT anonymous
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

    const typedQuestionnaire = questionnaire as Tables<'questionnaires'>

    if (typedQuestionnaire.is_anonymous) {
      return {
        success: false,
        error: 'Cannot import participants for anonymous questionnaires',
      }
    }

    // Prepare participant records
    const participantRecords = participants.map((p) => ({
      organization_id: organizationId,
      email: p.email,
      name: p.name || p.email.split('@')[0],
      metadata: {
        ...p.metadata,
        questionnaire_id: questionnaireId,
        imported: true,
      },
    }))

    // Insert participants (ignore duplicates based on email)
    const { data: insertedParticipants, error: insertError } = await (supabase as any)
      .from('participants')
      .upsert(participantRecords, {
        onConflict: 'organization_id,email',
        ignoreDuplicates: false,
      })
      .select()

    if (insertError) {
      return {
        success: false,
        error: 'Failed to import participants: ' + insertError.message,
      }
    }

    // Auto-generate invitation tokens for each participant
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const expiresAt = typedQuestionnaire.end_date
      ? new Date(typedQuestionnaire.end_date)
      : null

    for (const participant of insertedParticipants || []) {
      const typedParticipant = participant as Tables<'participants'>

      // Check if token already exists
      const { data: existingToken } = await supabase
        .from('participant_access_tokens')
        .select('token')
        .eq('participant_id', typedParticipant.id)
        .eq('questionnaire_id', questionnaireId)
        .maybeSingle()

      if (!existingToken) {
        // Generate new token
        const tokenBytes = new Uint8Array(32)
        crypto.getRandomValues(tokenBytes)
        const token = Array.from(tokenBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')

        // Create access token
        await (supabase as any)
          .from('participant_access_tokens')
          .insert({
            participant_id: typedParticipant.id,
            questionnaire_id: questionnaireId,
            token: token,
            expires_at: expiresAt ? expiresAt.toISOString() : null,
            is_shared: false,
          })
      }
    }

    return {
      success: true,
      imported: insertedParticipants?.length || 0,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get all participants for a questionnaire with their invitation links
 */
export async function getParticipantsWithLinks(
  questionnaireId: string,
  organizationId: string
): Promise<{
  success: boolean
  participants?: Array<{ participantId: string; email: string; name: string; link: string }>
  error?: string
}> {
  try {
    const supabase = await createSSRClient()

    // Check if user can manage the organization
    const canManage = await canManageOrg(supabase, organizationId)

    if (!canManage) {
      return {
        success: false,
        error: 'Unauthorized: Only organization admins and system admins can view participants',
      }
    }

    // Get questionnaire to verify it exists
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

    const typedQuestionnaire = questionnaire as Tables<'questionnaires'>

    if (typedQuestionnaire.is_anonymous) {
      return {
        success: false,
        error: 'Cannot get participants for anonymous questionnaires',
      }
    }

    // Get all participants for this organization
    const { data: participants, error: pError } = await supabase
      .from('participants')
      .select('*')
      .eq('organization_id', organizationId)

    if (pError) {
      return {
        success: false,
        error: 'Failed to fetch participants: ' + pError.message,
      }
    }

    if (!participants || participants.length === 0) {
      return {
        success: true,
        participants: [],
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const participantLinks: Array<{ participantId: string; email: string; name: string; link: string }> = []

    // Get tokens for each participant
    for (const participant of participants) {
      const typedParticipant = participant as Tables<'participants'>

      // Get token for this participant and questionnaire
      const { data: tokenData } = await supabase
        .from('participant_access_tokens')
        .select('token')
        .eq('participant_id', typedParticipant.id)
        .eq('questionnaire_id', questionnaireId)
        .maybeSingle()

      if (tokenData) {
        const typedToken = tokenData as { token: string }
        participantLinks.push({
          participantId: typedParticipant.id,
          email: typedParticipant.email,
          name: typedParticipant.name || typedParticipant.email,
          link: `${baseUrl}/q/${typedToken.token}`,
        })
      }
    }

    return {
      success: true,
      participants: participantLinks,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete multiple participants and their associated access tokens
 */
export async function deleteParticipants(
  participantIds: string[],
  organizationId: string
): Promise<{ success: boolean; deleted?: number; error?: string }> {
  try {
    const supabase = await createSSRClient()

    // Check if user can manage the organization
    const canManage = await canManageOrg(supabase, organizationId)

    if (!canManage) {
      return {
        success: false,
        error: 'Unauthorized: Only organization admins and system admins can delete participants',
      }
    }

    if (participantIds.length === 0) {
      return { success: true, deleted: 0 }
    }

    // Delete access tokens first (foreign key constraint)
    const { error: tokenError } = await supabase
      .from('participant_access_tokens')
      .delete()
      .in('participant_id', participantIds)

    if (tokenError) {
      return {
        success: false,
        error: 'Failed to delete participant tokens: ' + tokenError.message,
      }
    }

    // Delete participants
    const { error: participantError } = await supabase
      .from('participants')
      .delete()
      .in('id', participantIds)
      .eq('organization_id', organizationId)

    if (participantError) {
      return {
        success: false,
        error: 'Failed to delete participants: ' + participantError.message,
      }
    }

    return { success: true, deleted: participantIds.length }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Generate individual invitation links for all participants of a named questionnaire
 * Creates unique, personal tokens for each participant
 */
export async function generateParticipantInviteLinks(
  questionnaireId: string,
  organizationId: string
): Promise<{
  success: boolean
  links?: Array<{ participantId: string; email: string; name: string; link: string }>
  error?: string
}> {
  try {
    const supabase = await createSSRClient()

    // Check if user can manage the organization
    const canManage = await canManageOrg(supabase, organizationId)

    if (!canManage) {
      return {
        success: false,
        error: 'Unauthorized: Only organization admins and system admins can generate invite links',
      }
    }

    // Get questionnaire to verify it exists and is NOT anonymous
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

    const typedQuestionnaire = questionnaire as Tables<'questionnaires'>

    if (typedQuestionnaire.is_anonymous) {
      return {
        success: false,
        error: 'Cannot generate individual links for anonymous questionnaires',
      }
    }

    // Get all participants for this organization
    const { data: participants, error: pError } = await supabase
      .from('participants')
      .select('*')
      .eq('organization_id', organizationId)

    if (pError || !participants || participants.length === 0) {
      return {
        success: false,
        error: 'No participants found for this organization',
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const expiresAt = typedQuestionnaire.end_date
      ? new Date(typedQuestionnaire.end_date)
      : null

    const links: Array<{ participantId: string; email: string; name: string; link: string }> = []

    // Generate a token for each participant
    for (const participant of participants) {
      const typedParticipant = participant as Tables<'participants'>

      // Check if token already exists for this participant and questionnaire
      const { data: existingToken } = await supabase
        .from('participant_access_tokens')
        .select('token')
        .eq('participant_id', typedParticipant.id)
        .eq('questionnaire_id', questionnaireId)
        .maybeSingle()

      let token: string

      if (existingToken) {
        // Use existing token
        const typedExistingToken = existingToken as { token: string }
        token = typedExistingToken.token
      } else {
        // Generate new token
        const tokenBytes = new Uint8Array(32)
        crypto.getRandomValues(tokenBytes)
        token = Array.from(tokenBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')

        // Create access token for this specific participant
        const { error: tokenError } = await (supabase as any)
          .from('participant_access_tokens')
          .insert({
            participant_id: typedParticipant.id,
            questionnaire_id: questionnaireId,
            token: token,
            expires_at: expiresAt ? expiresAt.toISOString() : null,
            is_shared: false, // Individual token
          })

        if (tokenError) {
          console.error('Failed to create token for participant:', typedParticipant.email, tokenError)
          continue
        }
      }

      links.push({
        participantId: typedParticipant.id,
        email: typedParticipant.email,
        name: typedParticipant.name || typedParticipant.email,
        link: `${baseUrl}/q/${token}`,
      })
    }

    return {
      success: true,
      links,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send email invitations to participants with their individual access links
 * This is a placeholder - you'll need to integrate with an email service like Resend
 */
export async function sendParticipantInvitations(
  questionnaireId: string,
  organizationId: string,
  participantIds?: string[]
): Promise<{ success: boolean; sent?: number; error?: string }> {
  try {
    const supabase = await createSSRClient()

    // Check if user can manage the organization
    const canManage = await canManageOrg(supabase, organizationId)

    if (!canManage) {
      return {
        success: false,
        error: 'Unauthorized: Only organization admins and system admins can send invitations',
      }
    }

    // Get questionnaire details
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

    const typedQuestionnaire = questionnaire as Tables<'questionnaires'>

    if (typedQuestionnaire.is_anonymous) {
      return {
        success: false,
        error: 'Cannot send individual invitations for anonymous questionnaires',
      }
    }

    // Get organization details
    const { data: organization, error: orgError } = await supabase
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

    const typedOrganization = organization as Tables<'organizations'>

    // Get participants (either specific ones or all)
    let participantsQuery = supabase
      .from('participants')
      .select('*')
      .eq('organization_id', organizationId)

    if (participantIds && participantIds.length > 0) {
      participantsQuery = participantsQuery.in('id', participantIds)
    }

    const { data: participants, error: pError } = await participantsQuery

    if (pError || !participants || participants.length === 0) {
      return {
        success: false,
        error: 'No participants found',
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    let sentCount = 0

    // Send email to each participant
    for (const participant of participants) {
      const typedParticipant = participant as Tables<'participants'>

      // Get or create token for this participant
      const { data: existingToken } = await supabase
        .from('participant_access_tokens')
        .select('token')
        .eq('participant_id', typedParticipant.id)
        .eq('questionnaire_id', questionnaireId)
        .maybeSingle()

      let token: string

      if (existingToken) {
        const typedExistingToken = existingToken as { token: string }
        token = typedExistingToken.token
      } else {
        // Generate new token
        const tokenBytes = new Uint8Array(32)
        crypto.getRandomValues(tokenBytes)
        token = Array.from(tokenBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')

        const expiresAt = typedQuestionnaire.end_date
          ? new Date(typedQuestionnaire.end_date)
          : null

        const { error: tokenError } = await (supabase as any)
          .from('participant_access_tokens')
          .insert({
            participant_id: typedParticipant.id,
            questionnaire_id: questionnaireId,
            token: token,
            expires_at: expiresAt ? expiresAt.toISOString() : null,
            is_shared: false,
          })

        if (tokenError) {
          console.error('Failed to create token for participant:', typedParticipant.email, tokenError)
          continue
        }
      }

      const inviteLink = `${baseUrl}/q/${token}`

      // Send email via Resend
      try {
        const resendApiKey = process.env.RESEND_API_KEY
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com'

        if (!resendApiKey) {
          // If no API key is configured, log to console for demo/testing
          console.log(`
            ===== EMAIL INVITATION (Demo Mode - No Resend API Key) =====
            To: ${typedParticipant.email}
            Subject: You're invited to participate in "${typedQuestionnaire.title}"

            Dear ${typedParticipant.name},

            You have been invited by ${typedOrganization.name} to participate in the questionnaire: "${typedQuestionnaire.title}"

            ${typedQuestionnaire.description || ''}

            Please click the link below to access your personalized questionnaire:
            ${inviteLink}

            ${typedQuestionnaire.start_date ? `Available from: ${new Date(typedQuestionnaire.start_date).toLocaleDateString()}` : ''}
            ${typedQuestionnaire.end_date ? `Available until: ${new Date(typedQuestionnaire.end_date).toLocaleDateString()}` : ''}

            Best regards,
            ${typedOrganization.name}
            ===============================================================
          `)
          sentCount++
          continue
        }

        // Send via Resend API
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${typedOrganization.name} <${fromEmail}>`,
            to: [typedParticipant.email],
            subject: `You're invited to participate in "${typedQuestionnaire.title}"`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                  <h2 style="color: #2563eb; margin-top: 0;">Dear ${typedParticipant.name},</h2>
                  <p style="font-size: 16px;">
                    You have been invited by <strong>${typedOrganization.name}</strong> to participate in the questionnaire:
                  </p>
                  <h3 style="color: #1e40af; margin: 10px 0;">${typedQuestionnaire.title}</h3>
                  ${typedQuestionnaire.description ? `<p style="color: #6b7280; font-size: 14px;">${typedQuestionnaire.description}</p>` : ''}
                </div>

                <div style="margin: 30px 0; text-align: center;">
                  <p style="margin-bottom: 20px;">Please click the button below to access your personalized questionnaire:</p>
                  <a href="${inviteLink}"
                     style="background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
                    Access Questionnaire
                  </a>
                </div>

                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <p style="margin: 5px 0; font-size: 13px; color: #6b7280;">
                    <strong>Or copy this link:</strong><br/>
                    <span style="word-break: break-all; font-family: monospace; font-size: 12px;">${inviteLink}</span>
                  </p>
                </div>

                ${typedQuestionnaire.start_date || typedQuestionnaire.end_date ? `
                  <div style="margin: 20px 0; padding: 15px; border-left: 4px solid #3b82f6; background-color: #eff6ff;">
                    ${typedQuestionnaire.start_date ? `<p style="margin: 5px 0; font-size: 14px;"><strong>Available from:</strong> ${new Date(typedQuestionnaire.start_date).toLocaleDateString()}</p>` : ''}
                    ${typedQuestionnaire.end_date ? `<p style="margin: 5px 0; font-size: 14px;"><strong>Available until:</strong> ${new Date(typedQuestionnaire.end_date).toLocaleDateString()}</p>` : ''}
                  </div>
                ` : ''}

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 5px 0;">Best regards,</p>
                  <p style="margin: 5px 0; font-weight: bold;">${typedOrganization.name}</p>
                </div>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="font-size: 12px; color: #9ca3af;">
                    This is an automated email. Please do not reply to this message.
                  </p>
                </div>
              </body>
              </html>
            `,
          }),
        })

        if (response.ok) {
          sentCount++
        } else {
          const errorData = await response.text()
          console.error('Resend API error for:', typedParticipant.email, response.status, errorData)
        }
      } catch (emailError) {
        console.error('Failed to send email to:', typedParticipant.email, emailError)
      }
    }

    return {
      success: true,
      sent: sentCount,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete a questionnaire and all associated data
 * Returns the count of responses that will be deleted
 */
export async function deleteQuestionnaire(
  questionnaireId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string; responseCount?: number }> {
  try {
    const supabase = await createSSRClient()

    // Check if user can manage the organization
    const canManage = await canManageOrg(supabase, organizationId)

    if (!canManage) {
      return {
        success: false,
        error: 'Unauthorized: Only organization admins and system admins can delete questionnaires',
      }
    }

    // Get questionnaire to verify it exists
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

    // Count responses that will be deleted
    const { count: responseCount } = await supabase
      .from('questionnaire_responses')
      .select('*', { count: 'exact', head: true })
      .eq('questionnaire_id', questionnaireId)

    // Delete the questionnaire (CASCADE will handle related data)
    const { error: deleteError } = await supabase
      .from('questionnaires')
      .delete()
      .eq('id', questionnaireId)
      .eq('organization_id', organizationId)

    if (deleteError) {
      return {
        success: false,
        error: 'Failed to delete questionnaire: ' + deleteError.message,
      }
    }

    return {
      success: true,
      responseCount: responseCount || 0,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
