import React from 'react';

interface GlobalStandingProps {
  percentile: number | null;
  date: string | null;
  message?: string;
  className?: string;
}

/**
 * Displays the user's global standing (percentile ranking) compared to other users
 */
const GlobalStanding: React.FC<GlobalStandingProps> = ({ 
  percentile, 
  date, 
  message, 
  className = '' 
}) => {
  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Today';
    const dateObj = new Date(dateStr);
    return dateObj.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get color based on percentile
  const getPercentileColor = (percentileValue: number | null) => {
    if (percentileValue === null) return 'from-gray-600 to-gray-500';
    if (percentileValue <= 5) return 'from-amber-500 to-yellow-500';
    if (percentileValue <= 25) return 'from-indigo-500 to-blue-500';
    if (percentileValue <= 50) return 'from-teal-500 to-green-500';
    return 'from-purple-500 to-indigo-500';
  };

  const bgGradient = getPercentileColor(percentile);

  // Default message if none provided
  const standingMessage = message || (
    percentile 
      ? `Top ${percentile}% globally` 
      : 'Global ranking coming soon'
  );

  return (
    <div className={`rounded-xl overflow-hidden shadow-lg ${className}`}>
      <div className={`p-4 bg-gradient-to-r ${bgGradient}`}>
        <h3 className="text-white font-semibold text-lg">Global Standing</h3>
      </div>
      
      <div className="bg-white/10 backdrop-blur-sm p-4 text-white">
        <div className="text-center py-2">
          {percentile ? (
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                Top {percentile}%
              </div>
              <div className="text-white/70 text-sm">
                of all learners on {formatDate(date)}
              </div>
            </div>
          ) : (
            <div className="text-white/60">
              {standingMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalStanding;