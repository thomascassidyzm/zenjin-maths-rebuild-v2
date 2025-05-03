import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

/**
 * Scheduled job to calculate global daily statistics
 * This endpoint should be called by a scheduler (e.g. Vercel Cron Jobs)
 * It should run once per day, after midnight UTC
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify request is authorized
  // This is a simple API key check - in production, use a more secure method
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.CRON_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Calculate for yesterday's data
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get all user points from yesterday
    const { data: dailyStats, error } = await supabase
      .from('daily_user_stats')
      .select('points_earned')
      .eq('date', yesterdayStr);

    if (error) {
      console.error('Error fetching daily stats:', error);
      return res.status(500).json({ error: 'Failed to fetch daily stats' });
    }

    // If no data for yesterday, nothing to do
    if (!dailyStats || dailyStats.length === 0) {
      return res.status(200).json({ message: 'No activity yesterday, nothing to calculate' });
    }

    // Extract and sort points for percentile calculation
    const pointsArray = dailyStats.map(s => s.points_earned).sort((a, b) => a - b);
    const numUsers = pointsArray.length;

    // Calculate percentiles
    const percentiles = {
      percentile_10: calculatePercentile(pointsArray, 10),
      percentile_25: calculatePercentile(pointsArray, 25),
      percentile_50: calculatePercentile(pointsArray, 50), // median
      percentile_75: calculatePercentile(pointsArray, 75),
      percentile_90: calculatePercentile(pointsArray, 90),
      percentile_95: calculatePercentile(pointsArray, 95),
      percentile_99: calculatePercentile(pointsArray, 99)
    };

    // Store global stats
    const { data, error: insertError } = await supabase
      .from('global_daily_stats')
      .upsert({
        date: yesterdayStr,
        active_users: numUsers,
        ...percentiles,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing global stats:', insertError);
      return res.status(500).json({ error: 'Failed to store global stats' });
    }

    return res.status(200).json({
      message: `Global stats calculated for ${yesterdayStr}`,
      activeUsers: numUsers,
      percentiles
    });
  } catch (error) {
    console.error('Error calculating global stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Calculate a specific percentile from a sorted array
 */
function calculatePercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  
  const index = Math.floor((percentile / 100) * sortedArray.length);
  return sortedArray[Math.min(sortedArray.length - 1, index)];
}