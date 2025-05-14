import { useEffect } from 'react';
import dynamic from 'next/dynamic';

// Import only CSS on the server side
import styles from '../styles/test-session-metrics.module.css';

// Create a Next.js page that only renders on the client side
const ClientOnlyPage = dynamic(
  () => import('../components/ClientOnlySessionMetrics'),
  { 
    ssr: false,
    loading: () => (
      <div className={styles.testPage}>
        <h1>Loading Client-Only Session Metrics...</h1>
        <div className={styles.description}>
          <p>This page will load momentarily...</p>
          <p>It is designed to render entirely on the client to avoid SSR issues.</p>
        </div>
      </div>
    )
  }
);

export default function ClientOnlySessionMetricsPage() {
  // Set page title
  useEffect(() => {
    document.title = 'Client-Only Session Metrics';
  }, []);

  return <ClientOnlyPage />;
}