/**
 * Update User Profile Endpoint
 * 
 * Updates the authenticated user's profile information.
 */
import { createAuthHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { logApiInfo, logApiError } from '../../../lib/api/logging';

export default createAuthHandler(
  async (req, res, userId, db) => {
    try {
      // Extract profile fields to update
      const { 
        displayName,
        totalPoints,
        avgBlinkSpeed,
        evolutionLevel,
        totalSessions
      } = req.body;
      
      // Build update object with only fields that are provided
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      
      if (displayName !== undefined) updateData.display_name = displayName;
      if (totalPoints !== undefined) updateData.total_points = totalPoints;
      if (avgBlinkSpeed !== undefined) updateData.avg_blink_speed = avgBlinkSpeed;
      if (evolutionLevel !== undefined) updateData.evolution_level = evolutionLevel;
      if (totalSessions !== undefined) updateData.total_sessions = totalSessions;
      
      // If no fields to update besides timestamp
      if (Object.keys(updateData).length === 1) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          errorResponse('No profile fields provided to update')
        );
      }
      
      // Check if profile exists
      const { data: existingProfile, error: checkError } = await db
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (checkError && !checkError.message.includes('No rows found')) {
        logApiError('Profile Check', checkError, userId);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
          errorResponse('Failed to check profile existence')
        );
      }
      
      if (!existingProfile) {
        // Create new profile if it doesn't exist
        const newProfile = {
          id: userId,
          display_name: displayName || '',
          total_points: totalPoints || 0,
          avg_blink_speed: avgBlinkSpeed || 2.5,
          evolution_level: evolutionLevel || 1,
          total_sessions: totalSessions || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error: createError } = await db
          .from('profiles')
          .insert(newProfile);
        
        if (createError) {
          logApiError('Profile Creation', createError, userId);
          return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            errorResponse('Failed to create profile')
          );
        }
        
        logApiInfo('User/CreateProfile', 'Profile created', userId);
        return res.status(HTTP_STATUS.CREATED).json(
          successResponse({}, 'Profile created successfully')
        );
      }
      
      // Update existing profile
      const { error: updateError } = await db
        .from('profiles')
        .update(updateData)
        .eq('id', userId);
      
      if (updateError) {
        logApiError('Profile Update', updateError, userId);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
          errorResponse('Failed to update profile')
        );
      }
      
      logApiInfo('User/UpdateProfile', 'Profile updated', userId, {
        fieldsUpdated: Object.keys(updateData).filter(key => key !== 'updated_at')
      });
      
      return res.status(HTTP_STATUS.OK).json(
        successResponse({}, 'Profile updated successfully')
      );
    } catch (error) {
      // Error is automatically logged by the handler wrapper
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('Profile service unavailable')
      );
    }
  },
  {
    methods: ['POST', 'PUT'],
    context: 'User/UpdateProfile'
  }
);