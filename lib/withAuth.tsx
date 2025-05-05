import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

/**
 * Higher-order component to handle authentication for pages
 * @param Component The component to wrap with authentication
 * @param options Authentication options
 * @returns A wrapped component with authentication
 */
export default function withAuth(Component: any, options: { requireAuth: boolean } = { requireAuth: true }) {
  function WithAuth(props: any) {
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      // If authentication is required and user is not authenticated and not loading
      if (options.requireAuth && !isAuthenticated && !loading) {
        // Redirect to the new login page with return URL
        router.push({
          pathname: '/signin',
          query: { returnUrl: router.asPath }
        });
      }
    }, [isAuthenticated, loading, router]);

    // If loading, show a loading indicator
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="p-6 max-w-sm mx-auto bg-white rounded-md shadow-md">
            <div className="flex items-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
              <div className="text-lg font-medium text-gray-900">
                Loading authentication...
              </div>
            </div>
          </div>
        </div>
      );
    }

    // If authenticated or auth not required, render the component
    return <Component {...props} />;
  }

  // Copy getInitialProps so it will run
  if (Component.getInitialProps) {
    WithAuth.getInitialProps = Component.getInitialProps;
  }

  return WithAuth;
}