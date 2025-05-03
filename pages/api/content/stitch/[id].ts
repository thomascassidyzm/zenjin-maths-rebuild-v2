/**
 * API endpoint for fetching a single stitch
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

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
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Stitch ID is required' 
      });
    }
    
    // Fetch stitch from database
    const { data: stitch, error: stitchError } = await supabase
      .from('stitches')
      .select('id:stitch_id, thread_id, name, description, order, skip_number, distractor_level')
      .eq('stitch_id', id)
      .single();
    
    if (stitchError) {
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
    
    // Format response
    const formattedStitch = {
      id: stitch.id,
      threadId: stitch.thread_id,
      name: stitch.name,
      description: stitch.description,
      orderNumber: stitch.skip_number || 0,
      skipNumber: stitch.skip_number || 3,
      distractorLevel: stitch.distractor_level || 'L1',
      questions: (questions || []).map(q => ({
        id: q.id,
        stitchId: q.stitch_id,
        text: q.text,
        correctAnswer: q.correct_answer,
        distractors: q.distractors || {
          L1: '', L2: '', L3: ''
        }
      }))
    };
    
    return res.status(200).json({ 
      success: true, 
      stitch: formattedStitch
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