import React, { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import withAuth from '../lib/withAuth';

function TubeSimulator() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  // Redirect to the tube simulator HTML page
  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        // Redirect to the HTML simulator page using window.location
        // to ensure it's a full page load (not a Next.js client-side navigation)
        window.location.href = '/tube-simulator.html';
      } else {
        router.push('/signin');
      }
    }
  }, [isAuthenticated, loading, router]);

  return (
    <div className="min-h-screen player-bg flex items-center justify-center">
      <Head>
        <title>Tube Cycling Simulator | Zenjin Math</title>
      </Head>
      <div className="text-center text-white">
        <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
        <p>Redirecting to Tube Simulator...</p>
      </div>
    </div>
  );
}

export default withAuth(TubeSimulator, { requireAuth: true });