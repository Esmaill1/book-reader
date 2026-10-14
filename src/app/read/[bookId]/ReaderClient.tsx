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
  fetchCloudBooks,
  downloadCloudBookFile,
  isCloudConfigured,
} from '@/lib/supabase';
import { getLibraryCode } from '@/lib/auth';
import { useReadingSync } from '@/hooks/useReadingSync';
import ReaderChrome from '@/components/reader/ReaderChrome';
import SettingsDrawer from '@/components/reader/SettingsDrawer';
import TOCDrawer, { TOCItem } from '@/components/reader/TOCDrawer';
import BookmarksDrawer from '@/components/reader/BookmarksDrawer';
import PDFViewer from '@/components/reader/PDFViewer';
import EPUBViewer from '@/components/reader/EPUBViewer';
import { BookX, BookOpen } from 'lucide-react';
import styles from './page.module.css';

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 36;
const DEFAULT_FONT_SIZE = 18;
const FONT_STEP = 2;

const ERROR_OPEN_MESSAGE =
  'This book could not be opened. The file may be corrupted or missing.';

interface ReaderClientProps {
  bookId: string;
}

export default function ReaderClient({ bookId }: ReaderClientProps) {
  const [book, setBook] = useState<Book | null>(null);
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

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

  // Shared interaction lock for the viewers (keyboard / tap navigation pauses while a drawer is open)
  const interactionLockRef = useRef<boolean>(false);

  // Reader Settings
  const [settings, setSettings] = useState<ReaderSettings>({
    theme: 'night',
    typography: {
      fontSize: DEFAULT_FONT_SIZE,
      lineHeight: 1.6,
      fontFamily: 'sans',
      margin: 'normal',
      alignment: 'justify',
    },
    pdfView: {
      scrollMode: 'single',
      zoomMode: 'fit-page',
      customZoom: 1.0,
      colorMode: 'match-theme',
    },
  });

  // Sync hook
  const { updateProgress } = useReadingSync({
    bookId,
    initialPage: currentPage,
    initialCfi: currentCfi,
    totalPages,
  });

  const isReaderBlocked =
    isSettingsOpen || isTOCOpen || isBookmarksOpen;

  // Keep the lock ref in sync (checked inside viewer key handlers)
  interactionLockRef.current = isReaderBlocked;

  const handleRetry = useCallback(() => {
    setError(null);
    setRetryNonce((n) => n + 1);
  }, []);

  const handleViewerError = useCallback((message?: string) => {
    setError(message || ERROR_OPEN_MESSAGE);
    setLoading(false);
  }, []);

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

        // 2. If not local but cloud is configured, check cloud metadata first
        const activeCode = getLibraryCode();
        if (!bookMeta && isCloudConfigured()) {
          try {
            const cloudBooks = await fetchCloudBooks(activeCode);
            bookMeta = cloudBooks.find((b) => b.id === bookId);
          } catch {
            // ignore
          }
        }

        // 3. If binary not local but cloud is enabled, attempt cloud fetch
        if (!bookBinary && isCloudConfigured()) {
          const candidates = [
            bookMeta?.file_path,
            `${activeCode}/${bookId}.${bookMeta?.format || 'pdf'}`,
            `${activeCode}/${bookId}.${bookMeta?.format || 'epub'}`,
            `${bookId}.pdf`,
            `${bookId}.epub`,
          ].filter(Boolean) as string[];

          let cloudBuffer: ArrayBuffer | null = null;
          for (const path of candidates) {
            cloudBuffer = await downloadCloudBookFile(path);
            if (cloudBuffer) break;
          }

          if (cloudBuffer) {
            const mime = bookMeta?.format === 'pdf' ? 'application/pdf' : 'application/epub+zip';
            bookBinary = {
              data: cloudBuffer,
              type: mime,
            };
            if (bookMeta) {
              await saveLocalBook(bookMeta, cloudBuffer, mime);
            }
          }
        }

        if (!isMounted) return;

        if (!bookMeta || !bookBinary) {
          setError(ERROR_OPEN_MESSAGE);
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
        setPercent(
          Math.round((activePage / Math.max(1, bookMeta.total_pages || 1)) * 100)
        );

        // 4. Load saved bookmarks
        const savedAnnotations = await getLocalAnnotationsForBook(bookId);
        setBookmarks(savedAnnotations);

        // 5. Load theme & PDF settings from localStorage
        const savedTheme = (localStorage.getItem('bookera_theme') as any) || 'night';
        const savedScrollMode = localStorage.getItem('bookera_pdf_scroll_mode') as any;

        setSettings((prev) => ({
          ...prev,
          theme: savedTheme,
          pdfView: {
            ...prev.pdfView,
            scrollMode:
              savedScrollMode === 'continuous' || savedScrollMode === 'single'
                ? savedScrollMode
                : prev.pdfView.scrollMode,
          },
        }));
        document.documentElement.setAttribute('data-theme', savedTheme);

        setLoading(false);
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || ERROR_OPEN_MESSAGE);
          setLoading(false);
        }
      }
    }

    initBook();

    return () => {
      isMounted = false;
    };
  }, [bookId, retryNonce]);

  // Persist settings changes
  const handleUpdateSettings = useCallback(
    (updater: (prev: ReaderSettings) => ReaderSettings) => {
      setSettings((prev) => {
        const next = updater(prev);
        if (next.pdfView.scrollMode !== prev.pdfView.scrollMode) {
          localStorage.setItem('bookera_pdf_scroll_mode', next.pdfView.scrollMode);
        }
        return next;
      });
    },
    []
  );

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
    if (interactionLockRef.current) return;
    if (book?.format === 'pdf') {
      if (currentPage < totalPages) {
        handlePDFPageChange(currentPage + 1, totalPages);
      }
    } else if (book?.format === 'epub') {
      epubNextRef.current?.();
    }
  }, [book?.format, currentPage, totalPages, handlePDFPageChange]);

  const handlePrevPage = useCallback(() => {
    if (interactionLockRef.current) return;
    if (book?.format === 'pdf') {
      if (currentPage > 1) {
        handlePDFPageChange(currentPage - 1, totalPages);
      }
    } else if (book?.format === 'epub') {
      epubPrevRef.current?.();
    }
  }, [book?.format, currentPage, totalPages, handlePDFPageChange]);

  // Zoom Actions
  const handleZoomIn = useCallback(() => {
    if (book?.format === 'epub') {
      setSettings((prev) => ({
        ...prev,
        typography: {
          ...prev.typography,
          fontSize: Math.min(MAX_FONT_SIZE, prev.typography.fontSize + FONT_STEP),
        },
      }));
    } else {
      setSettings((prev) => {
        const currentZoom = prev.pdfView.customZoom || 1.0;
        const nextZoom = Math.min(3.0, Math.round((currentZoom + 0.15) * 100) / 100);
        return {
          ...prev,
          pdfView: {
            ...prev.pdfView,
            zoomMode: 'custom',
            customZoom: nextZoom,
          },
        };
      });
    }
  }, [book?.format]);

  const handleZoomOut = useCallback(() => {
    if (book?.format === 'epub') {
      setSettings((prev) => ({
        ...prev,
        typography: {
          ...prev.typography,
          fontSize: Math.max(MIN_FONT_SIZE, prev.typography.fontSize - FONT_STEP),
        },
      }));
    } else {
      setSettings((prev) => {
        const currentZoom = prev.pdfView.customZoom || 1.0;
        const nextZoom = Math.max(0.5, Math.round((currentZoom - 0.15) * 100) / 100);
        return {
          ...prev,
          pdfView: {
            ...prev.pdfView,
            zoomMode: 'custom',
            customZoom: nextZoom,
          },
        };
      });
    }
  }, [book?.format]);

  const handleZoomReset = useCallback(() => {
    if (book?.format === 'epub') {
      setSettings((prev) => ({
        ...prev,
        typography: {
          ...prev.typography,
          fontSize: DEFAULT_FONT_SIZE,
        },
      }));
    } else {
      setSettings((prev) => {
        const nextMode = prev.pdfView.zoomMode === 'fit-page' ? 'fit-width' : 'fit-page';
        return {
          ...prev,
          pdfView: {
            ...prev.pdfView,
            zoomMode: nextMode,
            customZoom: 1.0,
          },
        };
      });
    }
  }, [book?.format]);

  const zoomDisplay = React.useMemo(() => {
    if (book?.format === 'epub') {
      return `${settings.typography.fontSize}px`;
    }
    if (settings.pdfView.zoomMode === 'fit-page') return 'Fit';
    if (settings.pdfView.zoomMode === 'fit-width') return 'Width';
    return `${Math.round((settings.pdfView.customZoom || 1.0) * 100)}%`;
  }, [
    book?.format,
    settings.pdfView.zoomMode,
    settings.pdfView.customZoom,
    settings.typography.fontSize,
  ]);

  // Global Keyboard Shortcuts (+/-/0) + Escape (chrome toggle / drawer dismiss)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (isBookmarksOpen) {
          e.preventDefault();
          setIsBookmarksOpen(false);
        } else if (isTOCOpen) {
          e.preventDefault();
          setIsTOCOpen(false);
        } else if (isSettingsOpen) {
          e.preventDefault();
          setIsSettingsOpen(false);
        } else {
          setControlsVisible((v) => !v);
        }
        return;
      }

      if (interactionLockRef.current) return;

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleZoomReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    isSettingsOpen,
    isTOCOpen,
    isBookmarksOpen,
  ]);

  // Bookmark actions
  const isCurrentPageBookmarked = bookmarks.some(
    (bm) => bm.location_page === currentPage || (currentCfi && bm.location_cfi === currentCfi)
  );

  const handleToggleBookmark = async () => {
    if (interactionLockRef.current) return;
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
      <div
        className={styles.centerState}
        role="status"
        aria-live="polite"
      >
        <div className={styles.loadingBadge}>
          <BookOpen size={26} className={styles.loadingBookIcon} aria-hidden="true" />
          <span className={styles.loadingBadgeRing} aria-hidden="true" />
        </div>
        <p className={styles.loadingText}>Opening your book&hellip;</p>
        <div className={styles.skeletonBar} aria-hidden="true" />
      </div>
    );
  }

  if (error || !book || !fileData) {
    return (
      <div
        className={styles.errorState}
        role="region"
        aria-label="Reading error"
      >
        <div className={styles.errorBadge}>
          <BookX size={26} />
        </div>
        <h1 className={styles.errorTitle}>Couldn&apos;t open this book</h1>
        <p className={styles.errorMessage}>
          {error || ERROR_OPEN_MESSAGE}
        </p>
        <div className={styles.errorActions}>
          <Link href="/" className={styles.primaryAction}>
            Go to Library
          </Link>
          <button
            type="button"
            onClick={handleRetry}
            className={styles.secondaryAction}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.readerContainer}
      role="region"
      aria-label="Book reader"
    >
      <ReaderChrome
        visible={controlsVisible}
        bookTitle={book.title}
        chapterTitle={currentChapterTitle}
        currentPage={currentPage}
        totalPages={totalPages}
        percent={percent}
        isBookmarked={isCurrentPageBookmarked}
        zoomDisplay={zoomDisplay}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
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
          theme={settings.theme}
          settings={settings.pdfView}
          onPageChange={handlePDFPageChange}
          onTOCLoaded={handleTOCLoaded}
          onToggleControls={handleToggleControls}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onError={handleViewerError}
          interactionLockRef={interactionLockRef}
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
          onError={handleViewerError}
          interactionLockRef={interactionLockRef}
        />
      )}

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        format={book.format}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
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
