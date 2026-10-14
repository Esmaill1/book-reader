'use client';

import { useEffect, useRef, useCallback } from 'react';
import { ReadingSession } from '@/types';
import { saveLocalSession } from '@/lib/db';
import { syncSessionToCloud, isCloudConfigured } from '@/lib/supabase';
import { getLibraryCode } from '@/lib/auth';

interface UseReadingSyncProps {
  bookId: string;
  initialPage?: number;
  initialCfi?: string;
  totalPages?: number;
}

export function useReadingSync({
  bookId,
  initialPage = 1,
  initialCfi,
  totalPages = 1,
}: UseReadingSyncProps) {
  const currentSessionRef = useRef<ReadingSession>({
    id: bookId,
    book_id: bookId,
    current_page: initialPage,
    current_cfi: initialCfi,
    progress_percent: Math.min(100, Math.round((initialPage / Math.max(1, totalPages)) * 100)),
    last_read_at: new Date().toISOString(),
  });

  const totalPagesRef = useRef(totalPages);
  useEffect(() => {
    totalPagesRef.current = totalPages;
  }, [totalPages]);

  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Flush function to save to Local DB and Cloud
  const flushSync = useCallback(async (sessionToSync: ReadingSession) => {
    try {
      // 1. Always save locally immediately
      await saveLocalSession(sessionToSync);

      // 2. If cloud is available, push to Supabase
      if (isCloudConfigured()) {
        const activeCode = getLibraryCode();
        await syncSessionToCloud(sessionToSync, activeCode);
      }
    } catch (err) {
      console.warn('Error flushing reading session:', err);
    }
  }, []);

  // Update position with 2.5-second debounce
  const updateProgress = useCallback(
    (page: number, cfi?: string, total?: number) => {
      const activeTotal = total ?? totalPagesRef.current ?? 1;
      const percent = Math.min(100, Math.max(0, Math.round((page / Math.max(1, activeTotal)) * 100)));

      const updated: ReadingSession = {
        id: bookId,
        book_id: bookId,
        current_page: page,
        current_cfi: cfi,
        progress_percent: percent,
        last_read_at: new Date().toISOString(),
      };

      currentSessionRef.current = updated;

      // Reset debounce timer
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }

      syncTimerRef.current = setTimeout(() => {
        flushSync(updated);
      }, 2500);
    },
    [bookId, flushSync]
  );

  // Lifecycle flush: flush when user switches tabs or navigates away
  useEffect(() => {
    const handleVisibilityOrLeave = () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      flushSync(currentSessionRef.current);
    };

    window.addEventListener('visibilitychange', handleVisibilityOrLeave);
    window.addEventListener('pagehide', handleVisibilityOrLeave);
    window.addEventListener('beforeunload', handleVisibilityOrLeave);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityOrLeave);
      window.removeEventListener('pagehide', handleVisibilityOrLeave);
      window.removeEventListener('beforeunload', handleVisibilityOrLeave);
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      // flush on unmount
      flushSync(currentSessionRef.current);
    };
  }, [flushSync]);

  return {
    updateProgress,
    currentSessionRef,
    flushSync,
  };
}
