import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import EvolutionBadge from '../components/EvolutionBadge';
import BlinkSpeedDisplay from '../components/BlinkSpeedDisplay';
import GlobalStanding from '../components/GlobalStanding';
import RecentSessions from '../components/RecentSessions';
import SessionSummary from '../components/SessionSummary';

/**
 * Dashboard Preview - A demonstration page for the dashboard components
 * Shows all the dashboard components with mock data for testing
 */
export default function DashboardPreview() {
  const router = useRouter();
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Mock data for testing
  const mockEvolution = {
    currentLevel: "Pattern Seeker",
    levelNumber: 3,
    progress: 65,
    nextLevel: "Vision Runner"
  };

  const mockBlinkSpeed = 3.2;
  const mockBlinkSpeedTrend = 'improving';

  const mockGlobalStanding = {
    percentile: 15,
    date: "2023-04-22",
    message: "Top 15% globally today!"
  };

  const mockRecentSessions = [
    {
      id: "session1",
      timestamp: "2023-04-22T14:30:00Z",
      total_points: 450,
      correct_answers: 9,
      total_questions: 10,
      blink_speed: 2.8
    },
    {
      id: "session2",
      timestamp: "2023-04-21T09:15:00Z",
      total_points: 350,
      correct_answers: 7,
      total_questions: 10,
      blink_speed: 3.4
    },
    {
      id: "session3",
      timestamp: "2023-04-20T16:45:00Z",
      total_points: 500,
      correct_answers: 10,
      total_questions: 10,
      blink_speed: 2.5
    }
  ];

  const mockSessionData = {
    sessionId: "test-session",
    basePoints: 300,
    multiplier: 2.5,
    multiplierType: "Mastery Magic",
    totalPoints: 750,
    blinkSpeed: 2.4,
    correctAnswers: 9,
    totalQuestions: 10,
    firstTimeCorrect: 8
  };

  // Toggle session summary display for testing
  const toggleSessionSummary = () => {
    setShowSessionSummary(!showSessionSummary);
  };

  return (
    <div className="min-h-screen dashboard-bg">
      <Head>
        <title>Dashboard Preview | Zenjin Maths</title>
      </Head>

      {/* Background effects */}
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
            }}
            className="bubble"
          />
        ))}
      </div>

      <div className="container max-w-5xl mx-auto px-4 py-8 z-10 relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1 text-white">Dashboard Preview</h1>
            <p className="text-white/80">Test environment for dashboard components</p>
          </div>
          <Link href="/" className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-white">
            Home
          </Link>
        </div>

        {/* Controls for testing */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-8">
          <div className="flex flex-wrap gap-4">
            <button
              onClick={toggleSessionSummary}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
            >
              {showSessionSummary ? 'Hide' : 'Show'} Session Summary
            </button>
          </div>
        </div>

        {/* Session Summary (conditional) */}
        {showSessionSummary && (
          <div className="mb-8">
            <SessionSummary 
              sessionData={mockSessionData} 
              onComplete={() => setShowSessionSummary(false)} 
            />
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mb-6 border-b border-white/20">
          <nav className="flex space-x-6">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-1 -mb-px ${activeTab === 'overview' ? 'border-b-2 border-teal-400 text-teal-300 font-medium' : 'text-white/70 hover:text-white'}`}
            >
              Overview
            </button>
            <button 
              onClick={() => setActiveTab('stats')}
              className={`py-3 px-1 -mb-px ${activeTab === 'stats' ? 'border-b-2 border-teal-400 text-teal-300 font-medium' : 'text-white/70 hover:text-white'}`}
            >
              Detailed Stats
            </button>
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Evolution Badge */}
              <EvolutionBadge evolution={mockEvolution} />
              
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Blink Speed */}
                <BlinkSpeedDisplay 
                  blinkSpeed={mockBlinkSpeed} 
                  trend={mockBlinkSpeedTrend as 'improving' | 'steady' | 'declining'} 
                />
                
                {/* Points */}
                <div className="rounded-xl border border-white/20 bg-white/10 p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Total Points</h3>
                  <div className="text-3xl font-bold text-white">12,480</div>
                  <div className="text-xs text-white/70 mt-1">Lifetime achievement</div>
                </div>
              </div>
              
              {/* Continue Learning Button */}
              <div className="mt-6">
                <Link href="/" className="block bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-bold py-4 px-6 rounded-xl transition-colors text-lg text-center shadow-lg">
                  Continue Learning
                </Link>
              </div>
            </div>
            
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Global Standing */}
              <GlobalStanding 
                percentile={mockGlobalStanding.percentile} 
                date={mockGlobalStanding.date} 
                message={mockGlobalStanding.message} 
              />
              
              {/* Recent Sessions */}
              <RecentSessions sessions={mockRecentSessions} />
            </div>
          </div>
        )}
        
        {/* Detailed Stats Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Performance Metrics</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white/10 p-4 rounded-xl">
                  <p className="text-white/70 text-sm">Sessions Completed</p>
                  <p className="text-3xl font-bold text-teal-400">42</p>
                </div>
                
                <div className="bg-white/10 p-4 rounded-xl">
                  <p className="text-white/70 text-sm">Average Score</p>
                  <p className="text-3xl font-bold text-blue-400">85%</p>
                </div>
                
                <div className="bg-white/10 p-4 rounded-xl">
                  <p className="text-white/70 text-sm">Longest Streak</p>
                  <p className="text-3xl font-bold text-purple-400">7</p>
                  <p className="text-xs text-white/60">days</p>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold mb-3">Learning Progress by Subject</h3>
              <div className="space-y-4">
                <div className="bg-white/10 p-4 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-medium text-white">Number Sense</p>
                    <p className="text-white/70 text-sm">65%</p>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2.5">
                    <div className="bg-gradient-to-r from-teal-400 to-blue-500 h-2.5 rounded-full" style={{ width: '65%' }}></div>
                  </div>
                </div>
                
                <div className="bg-white/10 p-4 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-medium text-white">Operations</p>
                    <p className="text-white/70 text-sm">42%</p>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2.5">
                    <div className="bg-gradient-to-r from-blue-400 to-indigo-500 h-2.5 rounded-full" style={{ width: '42%' }}></div>
                  </div>
                </div>
                
                <div className="bg-white/10 p-4 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-medium text-white">Problem Solving</p>
                    <p className="text-white/70 text-sm">28%</p>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2.5">
                    <div className="bg-gradient-to-r from-purple-400 to-pink-500 h-2.5 rounded-full" style={{ width: '28%' }}></div>
                  </div>
                </div>
              </div>
            </div>
            
            <RecentSessions sessions={mockRecentSessions} />
          </div>
        )}
      </div>
    </div>
  );
}