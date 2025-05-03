import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Redirect page to working-player
 * 
 * This redirects users to the working implementation
 * to avoid confusion with broken player versions
 */
export default function RedirectToWorkingPlayer() {
  const router = useRouter();
  
  useEffect(() => {
    // Force a hard redirect for reliability
    window.location.href = '/working-player';
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
      <div className="text-center">
        <div className="animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4 mx-auto"></div>
        <p>Redirecting to the Working Player...</p>
      </div>
    </div>
  );
}