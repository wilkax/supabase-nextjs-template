-- Fix RLS policy for questionnaire_responses to allow anonymous participants to submit responses
-- The previous policy had a circular reference that prevented inserts

-- Drop the broken policy
DROP POLICY IF EXISTS "Participants can insert their own responses" ON questionnaire_responses;

-- Create a corrected policy that properly validates the participant exists
-- This allows participants (including anonymous ones) to insert responses
-- as long as the participant_id being inserted exists in the participants table
CREATE POLICY "Participants can insert their own responses"
ON questionnaire_responses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM participants p
    WHERE p.id = participant_id
  )
);

-- Also ensure participants can update their own responses
DROP POLICY IF EXISTS "Participants can update their own responses" ON questionnaire_responses;

CREATE POLICY "Participants can update their own responses"
ON questionnaire_responses
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM participants p
    WHERE p.id = questionnaire_responses.participant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM participants p
    WHERE p.id = participant_id
  )
);

