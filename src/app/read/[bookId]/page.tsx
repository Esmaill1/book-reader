'use client';

import dynamicImport from 'next/dynamic';
import { use, Suspense } from 'react';
import styles from './page.module.css';
import { BookOpen } from 'lucide-react';

function BrandedLoading() {
  return (
    <div className={styles.centerState} role="status" aria-live="polite">
      <div className={styles.loadingBadge} aria-hidden="true">
        <BookOpen size={26} className={styles.loadingBookIcon} />
        <span className={styles.loadingBadgeRing} />
      </div>
      <p className={styles.loadingText}>Opening your book&hellip;</p>
      <div className={styles.skeletonBar} aria-hidden="true" />
    </div>
  );
}

const ReaderClient = dynamicImport(() => import('./ReaderClient'), {
  ssr: false,
  loading: () => <BrandedLoading />,
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
    <Suspense fallback={<BrandedLoading />}>
      <ReaderContent params={params} />
    </Suspense>
  );
}
