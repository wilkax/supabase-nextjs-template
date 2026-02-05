'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { Json } from '@/lib/types'

/**
 * Submit or update a questionnaire response for a participant
 * Uses admin client to bypass RLS for anonymous participants
 */
export async function submitParticipantResponse(
  questionnaireId: string,
  participantId: string,
  answers: Json,
  existingResponseId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient()

    if (existingResponseId) {
      // Update existing response
      const { error: updateError } = await adminClient
        .from('questionnaire_responses')
        .update({
          answers: answers,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingResponseId)

      if (updateError) {
        console.error('Error updating response:', updateError)
        return {
          success: false,
          error: 'Failed to update response',
        }
      }
    } else {
      // Create new response
      const { error: insertError } = await adminClient
        .from('questionnaire_responses')
        .insert({
          questionnaire_id: questionnaireId,
          participant_id: participantId,
          answers: answers,
          submitted_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error('Error inserting response:', insertError)
        return {
          success: false,
          error: 'Failed to submit response',
        }
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error in submitParticipantResponse:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

