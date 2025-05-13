/**
 * API endpoint for fetching a single stitch
 * Enhanced to support unified content loading approach and user_state table creation
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { ensureUserStateTableExists } from '../../../../lib/initialization/initialize-unified-state';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { id, priority = 'medium' } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Stitch ID is required'
      });
    }

    // Extract user ID from request headers (from both anonymous and authenticated users)
    let userId = '';

    // Check for anonymous user ID first
    if (req.headers['x-anonymous-id']) {
      userId = req.headers['x-anonymous-id'] as string;
    }
    // Then check for authenticated user
    else if (req.headers.authorization) {
      const authHeader = req.headers.authorization;

      if (authHeader.startsWith('Bearer ')) {
        userId = authHeader.substring(7);
      }
    }

    // Log request details
    console.log(`API: Fetching stitch ${id} with priority ${priority}, user: ${userId || 'unknown'}`);

    // Ensure user_state table exists to support new users
    if (userId) {
      // We don't await this since it's not critical for returning the stitch
      ensureUserStateTableExists()
        .catch(err => console.error('Error ensuring user_state table exists:', err));
    }

    // Fetch stitch from database
    const { data: stitch, error: stitchError } = await supabase
      .from('stitches')
      .select('id:stitch_id, thread_id, name, description, content, order, skip_number, distractor_level')
      .eq('stitch_id', id)
      .single();

    if (stitchError) {
      console.error(`API: Error fetching stitch ${id}:`, stitchError);
      return res.status(404).json({
        success: false,
        error: 'Stitch not found'
      });
    }

    // Fetch questions for this stitch
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('id:question_id, stitch_id, text, correct_answer, distractors')
      .eq('stitch_id', id);

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      // Continue with empty questions array
    }

    // Extract tube number from stitch ID
    const tubeMatch = id.match(/stitch-T(\d+)-/);
    const tubeNumber = tubeMatch ? parseInt(tubeMatch[1]) : null;

    // Format response for unified content loading approach
    const formattedStitch = {
      id: stitch.id,
      threadId: stitch.thread_id,
      title: stitch.name || '',
      content: stitch.description || stitch.content || '',
      tubeNumber,
      order: stitch.order || 0,
      skipNumber: stitch.skip_number || 3,
      distractorLevel: stitch.distractor_level || 'L1',
      questions: (questions || []).map(q => ({
        id: q.id,
        question: q.text,
        correctAnswer: q.correct_answer,
        answers: [
          q.correct_answer,
          ...(q.distractors ?
            [q.distractors.L1, q.distractors.L2, q.distractors.L3].filter(Boolean) :
            [])
        ].filter(Boolean)
      }))
    };

    console.log(`API: Successfully fetched stitch ${id} with ${formattedStitch.questions.length} questions`);

    return res.status(200).json({
      success: true,
      ...formattedStitch  // Return stitch properties directly in the response
    });
  } catch (error: any) {
    console.error('Error in stitch API:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}