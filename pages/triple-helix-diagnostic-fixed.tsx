import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Redirect page for triple-helix-diagnostic-fixed
 * 
 * This redirects users to the triple-helix-debug page
 * to ensure they use the up-to-date debug tools
 */
export default function RedirectToDebugPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/triple-helix-debug');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
      <div className="text-center">
        <div className="animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4 mx-auto"></div>
        <p>Redirecting to the Triple-Helix Debug Tool...</p>
      </div>
    </div>
  );
}