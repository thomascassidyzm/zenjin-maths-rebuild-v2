import React from 'react';

interface SessionData {
  id: string;
  timestamp: string;
  total_points: number;
  correct_answers: number;
  total_questions: number;
  blink_speed: number | null;
}

interface RecentSessionsProps {
  sessions: SessionData[];
  className?: string;
}

/**
 * Displays a list of the user's recent learning sessions
 */
const RecentSessions: React.FC<RecentSessionsProps> = ({ sessions, className = '' }) => {
  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: 'numeric'
    });
  };

  // Format blink speed for display
  const formatBlinkSpeed = (speed: number | null) => {
    if (speed === null) return 'N/A';
    return `${speed.toFixed(1)}s`;
  };

  return (
    <div className={`rounded-xl overflow-hidden shadow-lg ${className}`}>
      <div className="p-4 bg-gradient-to-r from-slate-700 to-slate-600">
        <h3 className="text-white font-semibold text-lg">Recent Sessions</h3>
      </div>
      
      <div className="bg-white/10 backdrop-blur-sm text-white">
        {sessions.length > 0 ? (
          <div className="divide-y divide-white/10">
            {sessions.map((session) => (
              <div key={session.id} className="p-4 hover:bg-white/5 transition-colors">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{formatDate(session.timestamp)}</div>
                    <div className="text-sm text-white/70 mt-1">
                      {session.correct_answers} / {session.total_questions} correct • {formatBlinkSpeed(session.blink_speed)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-teal-400 font-bold text-xl">
                      +{session.total_points}
                    </div>
                    <div className="text-xs text-white/70">points</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-white/60">
            <p>No recent sessions</p>
            <p className="text-sm mt-1">Complete a learning session to see your history</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentSessions;