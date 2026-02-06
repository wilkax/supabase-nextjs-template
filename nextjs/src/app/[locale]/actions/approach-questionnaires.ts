'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/auth/roles'
import { Tables } from '@/lib/types'
import { translateQuestionnaireSchema, SupportedLanguage } from '@/lib/questionnaire/deepl-translation'

type ApproachQuestionnaire = Tables<'approach_questionnaires'>
type ApproachQuestionnaireVersion = Tables<'approach_questionnaire_versions'>
type ApproachQuestionnaireTranslation = Tables<'approach_questionnaire_translations'>

/**
 * Publish a new version of an approach questionnaire
 * This creates an immutable snapshot of the current draft
 */
export async function publishQuestionnaireVersion(
  questionnaireId: string
): Promise<{ success: boolean; error?: string; version?: ApproachQuestionnaireVersion }> {
  try {
    const supabase = await createSSRClient()

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(supabase)
    if (!isAdmin) {
      return {
        success: false,
        error: 'Unauthorized: Only system admins can publish questionnaire versions',
      }
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Get the questionnaire
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: questionnaire, error: qError } = await (supabase as any)
      .from('approach_questionnaires')
      .select('*')
      .eq('id', questionnaireId)
      .single()

    if (qError || !questionnaire) {
      return { success: false, error: 'Questionnaire not found' }
    }

    const typedQuestionnaire = questionnaire as ApproachQuestionnaire

    // Calculate next version number
    const nextVersion = typedQuestionnaire.current_version + 1

    // Create the version snapshot
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: version, error: vError } = await (supabase as any)
      .from('approach_questionnaire_versions')
      .insert({
        approach_questionnaire_id: questionnaireId,
        version: nextVersion,
        title: typedQuestionnaire.title,
        description: typedQuestionnaire.description,
        schema: typedQuestionnaire.schema,
        master_language: typedQuestionnaire.master_language,
        published_by: user.id,
      })
      .select()
      .single()

    if (vError) {
      return { success: false, error: 'Failed to create version: ' + vError.message }
    }

    // Update the questionnaire's current_version and reset has_draft_changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('approach_questionnaires')
      .update({
        current_version: nextVersion,
        has_draft_changes: false,
      })
      .eq('id', questionnaireId)

    if (updateError) {
      return { success: false, error: 'Failed to update questionnaire: ' + updateError.message }
    }

    return {
      success: true,
      version: version as ApproachQuestionnaireVersion,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get version history for a questionnaire
 */
export async function getVersionHistory(
  questionnaireId: string
): Promise<{ success: boolean; error?: string; versions?: ApproachQuestionnaireVersion[] }> {
  try {
    const supabase = await createSSRClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: versions, error } = await (supabase as any)
      .from('approach_questionnaire_versions')
      .select('*')
      .eq('approach_questionnaire_id', questionnaireId)
      .order('version', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      versions: versions as ApproachQuestionnaireVersion[],
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get translations for a specific version
 */
export async function getVersionTranslations(
  versionId: string
): Promise<{ success: boolean; error?: string; translations?: ApproachQuestionnaireTranslation[] }> {
  try {
    const supabase = await createSSRClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: translations, error } = await (supabase as any)
      .from('approach_questionnaire_translations')
      .select('*')
      .eq('version_id', versionId)

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      translations: translations as ApproachQuestionnaireTranslation[],
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Trigger translation for a published version
 * This uses DeepL API to translate the questionnaire schema
 */
export async function translateQuestionnaireVersion(
  versionId: string,
  targetLanguage: SupportedLanguage
): Promise<{ success: boolean; error?: string; translation?: ApproachQuestionnaireTranslation }> {
  try {
    const supabase = await createSSRClient()

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(supabase)
    if (!isAdmin) {
      return {
        success: false,
        error: 'Unauthorized: Only system admins can trigger translations',
      }
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Get the version
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: version, error: vError } = await (supabase as any)
      .from('approach_questionnaire_versions')
      .select('*')
      .eq('id', versionId)
      .single()

    if (vError || !version) {
      return { success: false, error: 'Version not found' }
    }

    const typedVersion = version as ApproachQuestionnaireVersion

    // Check if translation already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingTranslation } = await (supabase as any)
      .from('approach_questionnaire_translations')
      .select('*')
      .eq('version_id', versionId)
      .eq('language', targetLanguage)
      .maybeSingle()

    if (existingTranslation) {
      return {
        success: false,
        error: `Translation to ${targetLanguage} already exists for this version`,
      }
    }

    // Translate using DeepL
    const translated = await translateQuestionnaireSchema(
      typedVersion.schema,
      typedVersion.title,
      typedVersion.description,
      targetLanguage,
      typedVersion.master_language as SupportedLanguage
    )

    // Store the translation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: translation, error: tError } = await (supabase as any)
      .from('approach_questionnaire_translations')
      .insert({
        version_id: versionId,
        language: targetLanguage,
        title: translated.title,
        description: translated.description,
        schema: translated.schema,
        translated_by: user.id,
      })
      .select()
      .single()

    if (tError) {
      return { success: false, error: 'Failed to store translation: ' + tError.message }
    }

    return {
      success: true,
      translation: translation as ApproachQuestionnaireTranslation,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Mark questionnaire as having draft changes
 * Called when the admin saves edits to the draft
 */
export async function markDraftChanged(
  questionnaireId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSSRClient()

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(supabase)
    if (!isAdmin) {
      return {
        success: false,
        error: 'Unauthorized: Only system admins can edit questionnaires',
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('approach_questionnaires')
      .update({ has_draft_changes: true })
      .eq('id', questionnaireId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

