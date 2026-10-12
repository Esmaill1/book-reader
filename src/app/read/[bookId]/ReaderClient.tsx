'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Book,
  ReaderSettings,
  BookAnnotation,
} from '@/types';
import {
  getLocalBook,
  getLocalBookFile,
  getLocalSession,
  getLocalAnnotationsForBook,
  saveLocalAnnotation,
  deleteLocalAnnotation,
  saveLocalBook,
} from '@/lib/db';
import {
  fetchCloudSession,
  downloadCloudBookFile,
  isCloudConfigured,
} from '@/lib/supabase';
import { useReadingSync } from '@/hooks/useReadingSync';
import ReaderChrome from '@/components/reader/ReaderChrome';
import SettingsDrawer from '@/components/reader/SettingsDrawer';
import TOCDrawer, { TOCItem } from '@/components/reader/TOCDrawer';
import BookmarksDrawer from '@/components/reader/BookmarksDrawer';
import PDFViewer from '@/components/reader/PDFViewer';
import EPUBViewer from '@/components/reader/EPUBViewer';
import { Loader2 } from 'lucide-react';
import styles from './page.module.css';

interface ReaderClientProps {
  bookId: string;
}

export default function ReaderClient({ bookId }: ReaderClientProps) {
  const [book, setBook] = useState<Book | null>(null);
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chrome & Drawers visibility
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTOCOpen, setIsTOCOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);

  // TOC & Annotations
  const [tocItems, setTOCItems] = useState<TOCItem[]>([]);
  const [bookmarks, setBookmarks] = useState<BookAnnotation[]>([]);
  const [currentChapterTitle, setCurrentChapterTitle] = useState<string>('');

  // Reader Position State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [percent, setPercent] = useState<number>(0);
  const [currentCfi, setCurrentCfi] = useState<string | undefined>(undefined);

  // EPUB next/prev handlers
  const epubNextRef = useRef<(() => void) | null>(null);
  const epubPrevRef = useRef<(() => void) | null>(null);

  // Reader Settings
  const [settings, setSettings] = useState<ReaderSettings>({
    theme: 'night',
    typography: {
      fontSize: 18,
      lineHeight: 1.6,
      fontFamily: 'sans',
      margin: 'normal',
      alignment: 'justify',
    },
    pdfView: {
      scrollMode: 'single',
      zoomMode: 'fit-page',
      customZoom: 1.0,
    },
  });

  // Sync hook
  const { updateProgress } = useReadingSync({
    bookId,
    initialPage: currentPage,
    initialCfi: currentCfi,
    totalPages,
  });

  // Load Book & Session
  useEffect(() => {
    let isMounted = true;

    async function initBook() {
      try {
        setLoading(true);
        setError(null);

        // 1. Try local book metadata
        let bookMeta = await getLocalBook(bookId);
        let bookBinary = await getLocalBookFile(bookId);

        // 2. If not local but cloud is enabled, attempt cloud fetch
        if (!bookBinary && isCloudConfigured()) {
          const cloudBuffer =
            (await downloadCloudBookFile(`${bookId}.pdf`)) ||
            (await downloadCloudBookFile(`${bookId}.epub`));
          if (cloudBuffer) {
            bookBinary = {
              data: cloudBuffer,
              type: 'application/octet-stream',
            };
            if (bookMeta) {
              await saveLocalBook(bookMeta, cloudBuffer, bookBinary.type);
            }
          }
        }

        if (!isMounted) return;

        if (!bookMeta || !bookBinary) {
          setError('Book file not found in local storage or cloud.');
          setLoading(false);
          return;
        }

        setBook(bookMeta);
        setFileData(bookBinary.data);
        setTotalPages(bookMeta.total_pages || 1);

        // 3. Load latest reading progress
        const localSession = await getLocalSession(bookId);
        let activePage = localSession?.current_page || 1;
        let activeCfi = localSession?.current_cfi;

        if (isCloudConfigured()) {
          try {
            const cloudSession = await fetchCloudSession(bookId);
            if (cloudSession && cloudSession.last_read_at) {
              const cloudTime = new Date(cloudSession.last_read_at).getTime();
              const localTime = localSession?.last_read_at
                ? new Date(localSession.last_read_at).getTime()
                : 0;

              // Resume furthest if cloud is newer
              if (cloudTime > localTime) {
                activePage = cloudSession.current_page || activePage;
                activeCfi = cloudSession.current_cfi || activeCfi;
              }
            }
          } catch {}
        }

        setCurrentPage(activePage);
        setCurrentCfi(activeCfi);
        setPercent(Math.round((activePage / Math.max(1, bookMeta.total_pages || 1)) * 100));

        // 4. Load saved bookmarks
        const savedAnnotations = await getLocalAnnotationsForBook(bookId);
        setBookmarks(savedAnnotations);

        // 5. Load theme from localStorage
        const savedTheme = (localStorage.getItem('bookera_theme') as any) || 'night';
        setSettings((prev) => ({ ...prev, theme: savedTheme }));
        document.documentElement.setAttribute('data-theme', savedTheme);

        setLoading(false);
      } catch (err: any) {
        console.error('Failed to initialize reader:', err);
        if (isMounted) {
          setError(err?.message || 'Error opening book');
          setLoading(false);
        }
      }
    }

    initBook();

    return () => {
      isMounted = false;
    };
  }, [bookId]);

  // Handle PDF page change
  const handlePDFPageChange = useCallback(
    (page: number, total: number) => {
      setCurrentPage(page);
      setTotalPages(total);
      const calcPercent = Math.min(100, Math.round((page / Math.max(1, total)) * 100));
      setPercent(calcPercent);
      updateProgress(page, undefined, total);
    },
    [updateProgress]
  );

  // Handle EPUB location change
  const handleEPUBLocationChange = useCallback(
    (cfi: string, pct: number, loc: number, total: number) => {
      setCurrentCfi(cfi);
      setPercent(pct);
      setCurrentPage(loc);
      setTotalPages(total);
      updateProgress(loc, cfi, total);
    },
    [updateProgress]
  );

  // Jump to specific page
  const handleScrubberChange = (targetPage: number) => {
    setCurrentPage(targetPage);
    if (book?.format === 'pdf') {
      handlePDFPageChange(targetPage, totalPages);
    }
  };

  // Next / Prev actions
  const handleNextPage = useCallback(() => {
    if (book?.format === 'pdf') {
      if (currentPage < totalPages) {
        handlePDFPageChange(currentPage + 1, totalPages);
      }
    } else if (book?.format === 'epub') {
      epubNextRef.current?.();
    }
  }, [book?.format, currentPage, totalPages, handlePDFPageChange]);

  const handlePrevPage = useCallback(() => {
    if (book?.format === 'pdf') {
      if (currentPage > 1) {
        handlePDFPageChange(currentPage - 1, totalPages);
      }
    } else if (book?.format === 'epub') {
      epubPrevRef.current?.();
    }
  }, [book?.format, currentPage, totalPages, handlePDFPageChange]);

  // Bookmark actions
  const isCurrentPageBookmarked = bookmarks.some(
    (bm) => bm.location_page === currentPage || (currentCfi && bm.location_cfi === currentCfi)
  );

  const handleToggleBookmark = async () => {
    if (isCurrentPageBookmarked) {
      const existing = bookmarks.find(
        (bm) => bm.location_page === currentPage || (currentCfi && bm.location_cfi === currentCfi)
      );
      if (existing) {
        await deleteLocalAnnotation(existing.id);
        setBookmarks((prev) => prev.filter((b) => b.id !== existing.id));
      }
    } else {
      const newBm: BookAnnotation = {
        id: crypto.randomUUID(),
        book_id: bookId,
        type: 'bookmark',
        location_page: currentPage,
        location_cfi: currentCfi,
        created_at: new Date().toISOString(),
      };
      await saveLocalAnnotation(newBm);
      setBookmarks((prev) => [newBm, ...prev]);
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    await deleteLocalAnnotation(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  // TOC select
  const handleSelectTOCItem = (item: TOCItem) => {
    setCurrentChapterTitle(item.label);
    if (item.page && book?.format === 'pdf') {
      handlePDFPageChange(item.page, totalPages);
    }
  };

  const handleTOCLoaded = useCallback((items: TOCItem[]) => {
    setTOCItems(items);
  }, []);

  const handleToggleControls = useCallback(() => {
    setControlsVisible((prev) => !prev);
  }, []);

  if (loading) {
    return (
      <div className={styles.centerState}>
        <Loader2 size={40} className={styles.spinner} />
        <p>Opening book in reader...</p>
      </div>
    );
  }

  if (error || !book || !fileData) {
    return (
      <div className={styles.centerState}>
        <p>{error || 'Unable to open book.'}</p>
        <Link href="/" className={styles.backHomeBtn}>
          Back to Library
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.readerContainer}>
      <ReaderChrome
        visible={controlsVisible}
        bookTitle={book.title}
        chapterTitle={currentChapterTitle}
        currentPage={currentPage}
        totalPages={totalPages}
        percent={percent}
        isBookmarked={isCurrentPageBookmarked}
        onToggleBookmark={handleToggleBookmark}
        onOpenTOC={() => setIsTOCOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onPageChange={handleScrubberChange}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
      />

      {/* Reader Engine Canvas */}
      {book.format === 'pdf' ? (
        <PDFViewer
          data={fileData}
          initialPage={currentPage}
          currentPage={currentPage}
          settings={settings.pdfView}
          onPageChange={handlePDFPageChange}
          onTOCLoaded={handleTOCLoaded}
          onToggleControls={handleToggleControls}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
        />
      ) : (
        <EPUBViewer
          data={fileData}
          initialCfi={currentCfi}
          theme={settings.theme}
          typography={settings.typography}
          onLocationChange={handleEPUBLocationChange}
          onTOCLoaded={handleTOCLoaded}
          onToggleControls={handleToggleControls}
          onNextRef={epubNextRef}
          onPrevRef={epubPrevRef}
        />
      )}

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        format={book.format}
        settings={settings}
        onUpdateSettings={setSettings}
      />

      {/* TOC Drawer */}
      <TOCDrawer
        isOpen={isTOCOpen}
        onClose={() => setIsTOCOpen(false)}
        items={tocItems}
        onSelect={handleSelectTOCItem}
      />

      {/* Bookmarks Drawer */}
      <BookmarksDrawer
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        bookmarks={bookmarks}
        onSelect={(bm) => {
          if (bm.location_page) {
            handlePDFPageChange(bm.location_page, totalPages);
          }
        }}
        onDelete={handleDeleteBookmark}
      />
    </div>
  );
}
