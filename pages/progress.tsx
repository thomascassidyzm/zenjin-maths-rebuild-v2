import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/auth/supabaseClient';

export default function Progress() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState({
    tubes: [],
    threads: [],
    stitches: {
      total: 0,
      completed: 0,
      inProgress: 0
    },
    recentSessions: []
  });
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      router.push('/signin');
    }
  }, [isAuthenticated, loading, router]);
  
  // Load progress data
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadProgressData();
    }
  }, [isAuthenticated, user]);
  
  const loadProgressData = async () => {
    try {
      setLoading(true);
      
      if (!user?.id) return;
      
      // Get stitch progress
      const { data: stitchData, error: stitchError } = await supabase
        .from('user_stitch_progress')
        .select('*, stitch:stitch_id(*)')
        .eq('user_id', user.id);
      
      if (stitchError) {
        console.error('Error fetching stitch progress:', stitchError);
      } else if (stitchData) {
        // Count stitches by status
        const completedStitches = stitchData.filter(s => s.completed).length;
        const inProgressStitches = stitchData.filter(s => !s.completed && s.started).length;
        
        setProgressData(prev => ({
          ...prev,
          stitches: {
            total: stitchData.length,
            completed: completedStitches,
            inProgress: inProgressStitches
          }
        }));
      }
      
      // Get recent sessions
      const { data: sessionData, error: sessionError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (sessionError) {
        console.error('Error fetching session data:', sessionError);
      } else if (sessionData) {
        setProgressData(prev => ({
          ...prev,
          recentSessions: sessionData
        }));
      }
      
      // In a real implementation, we would also fetch tube and thread progress
      // For now we'll use placeholder data
      setProgressData(prev => ({
        ...prev,
        tubes: [
          { id: 'tube1', name: 'Number Sense', progress: 0.65 },
          { id: 'tube2', name: 'Addition', progress: 0.3 },
          { id: 'tube3', name: 'Subtraction', progress: 0.1 }
        ],
        threads: [
          { id: 'thread1', name: 'Counting', tubeId: 'tube1', progress: 0.85 },
          { id: 'thread2', name: 'Number Recognition', tubeId: 'tube1', progress: 0.75 },
          { id: 'thread3', name: 'Comparing Numbers', tubeId: 'tube1', progress: 0.35 },
          { id: 'thread4', name: 'Basic Addition', tubeId: 'tube2', progress: 0.45 },
          { id: 'thread5', name: 'Addition Strategies', tubeId: 'tube2', progress: 0.15 },
          { id: 'thread6', name: 'Basic Subtraction', tubeId: 'tube3', progress: 0.1 }
        ]
      }));
    } catch (error) {
      console.error('Error loading progress data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  if (loading) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen player-bg flex flex-col items-center text-white relative">
      <Head>
        <title>My Progress | Zenjin Maths</title>
        <meta name="description" content="Track your learning progress" />
      </Head>
      
      {/* Bubbles animation - matching the homepage style */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {Array.from({ length: 30 }, (_, i) => ({
          id: i,
          size: Math.floor(Math.random() * 100) + 20,
          left: `${Math.random() * 100}%`,
          delay: Math.random() * 15,
          duration: (Math.random() * 20 + 15),
        })).map((bubble) => (
          <div
            key={bubble.id}
            style={{
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              position: 'absolute',
              left: bubble.left,
              bottom: '-100px',
              animationDelay: `${bubble.delay}s`,
              animationDuration: `${bubble.duration}s`,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              animation: 'float linear infinite',
            }}
          />
        ))}
      </div>
      
      <div className="container max-w-4xl mx-auto px-4 py-8 z-10">
        {/* Header with navigation */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">My Progress</h1>
          <div className="flex space-x-4">
            <button 
              onClick={() => router.push('/dashboard')}
              className="text-white hover:text-teal-300 transition-colors"
            >
              Dashboard
            </button>
            <button 
              onClick={() => router.push('/account')}
              className="text-white hover:text-teal-300 transition-colors"
            >
              My Account
            </button>
          </div>
        </div>
        
        {/* Progress Overview */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Progress Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/10 p-4 rounded-xl animate-scaleIn delay-1">
              <p className="text-white/70 text-sm">Stitches Completed</p>
              <p className="text-3xl font-bold text-teal-400">
                {progressData.stitches.completed} / {progressData.stitches.total}
              </p>
              <div className="w-full bg-white/10 rounded-full h-2.5 mt-2">
                <div 
                  className="bg-teal-400 h-2.5 rounded-full" 
                  style={{ width: `${progressData.stitches.total ? (progressData.stitches.completed / progressData.stitches.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            
            <div className="bg-white/10 p-4 rounded-xl animate-scaleIn delay-2">
              <p className="text-white/70 text-sm">In Progress</p>
              <p className="text-3xl font-bold text-blue-400">
                {progressData.stitches.inProgress}
              </p>
              <div className="w-full bg-white/10 rounded-full h-2.5 mt-2">
                <div 
                  className="bg-blue-400 h-2.5 rounded-full" 
                  style={{ width: `${progressData.stitches.total ? (progressData.stitches.inProgress / progressData.stitches.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            
            <div className="bg-white/10 p-4 rounded-xl animate-scaleIn delay-3">
              <p className="text-white/70 text-sm">Overall Completion</p>
              <p className="text-3xl font-bold text-purple-400">
                {progressData.stitches.total ? Math.round((progressData.stitches.completed / progressData.stitches.total) * 100) : 0}%
              </p>
              <p className="text-xs text-white/50 mt-1">Free tier: 15 stitches</p>
            </div>
          </div>
        </div>
        
        {/* Learning Tubes Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Learning Tubes</h2>
            
            <div className="space-y-4">
              {progressData.tubes.map((tube) => (
                <div key={tube.id} className="bg-white/10 p-4 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-medium text-white">{tube.name}</p>
                    <p className="text-white/70 text-sm">{Math.round(tube.progress * 100)}%</p>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2.5">
                    <div 
                      className="bg-gradient-to-r from-teal-400 to-blue-500 h-2.5 rounded-full" 
                      style={{ width: `${tube.progress * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Recent Activity */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
            
            {progressData.recentSessions.length > 0 ? (
              <div className="space-y-3">
                {progressData.recentSessions.map((session, index) => (
                  <div key={session.id || index} className="bg-white/10 p-3 rounded-xl flex justify-between">
                    <div>
                      <p className="font-medium text-white">Learning Session</p>
                      <p className="text-white/70 text-xs">{formatDate(session.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-teal-400 font-bold">+{session.points || 0} pts</p>
                      <p className="text-white/70 text-xs">{session.duration ? `${Math.round(session.duration / 60)} min` : '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/70 text-center py-4">No recent activity</p>
            )}
            
            <div className="mt-6">
              <Link href="/">
                <a className="block bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-6 rounded-xl transition-colors text-center shadow-lg">
                  Continue Learning
                </a>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}