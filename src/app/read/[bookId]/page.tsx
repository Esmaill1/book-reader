'use client';

import dynamicImport from 'next/dynamic';
import { use, Suspense } from 'react';
import styles from './page.module.css';
import { Loader2 } from 'lucide-react';

const ReaderClient = dynamicImport(() => import('./ReaderClient'), {
  ssr: false,
  loading: () => (
    <div className={styles.centerState}>
      <Loader2 size={40} className={styles.spinner} />
      <p>Initializing Book Reader...</p>
    </div>
  ),
});

function ReaderContent({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = use(params);
  return <ReaderClient bookId={bookId} />;
}

interface PageProps {
  params: Promise<{ bookId: string }>;
}

export default function Page({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className={styles.centerState}>
          <Loader2 size={40} className={styles.spinner} />
          <p>Loading reader...</p>
        </div>
      }
    >
      <ReaderContent params={params} />
    </Suspense>
  );
}
