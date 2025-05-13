import React from 'react';
import { useRouter } from 'next/router';

// Simple redirect page that forwards to the working server-persistence-test page
export default function PositionTestSimple() {
  const router = useRouter();

  // Redirect to the server persistence test page on component mount
  React.useEffect(() => {
    router.push('/server-persistence-test');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-4">Redirecting...</h1>
      <p>Taking you to the server persistence test page.</p>
      <p>If you are not redirected automatically, <a href="/server-persistence-test" className="text-blue-400 underline">click here</a>.</p>
    </div>
  );
}