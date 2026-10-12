'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { PDFViewSettings, ReadingTheme } from '@/types';
import { TOCItem } from './TOCDrawer';
import PDFContinuousView from './PDFContinuousView';
import { BookOpen, BookX } from 'lucide-react';
import styles from './PDFViewer.module.css';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export const PDF_PAPER_WHITE = '#ffffff';

export interface PDFThemeSurface {
  paper: string;
  canvasFilter: string;
  blend: 'normal' | 'multiply';
  shadow: string;
}

// Single source of truth for PDF page theming. Colors mirror globals.css
// theme tokens; token values can't be used on canvas pixels so they are kept
// in one map instead of being scattered across CSS + JS.
export const PDF_THEME_MAP: Record<ReadingTheme, PDFThemeSurface> = {
  day: {
    paper: '#ffffff',
    canvasFilter: 'none',
    blend: 'normal',
    shadow: '0 var(--space-2) var(--space-6) rgba(16, 24, 40, 0.18)',
  },
  sepia: {
    paper: '#fbf0d9',
    canvasFilter: 'sepia(0.68) contrast(0.92) brightness(0.96)',
    blend: 'multiply',
    shadow: '0 var(--space-2) var(--space-6) rgba(74, 56, 36, 0.22)',
  },
  night: {
    paper: '#141a17',
    canvasFilter: 'invert(0.88) hue-rotate(180deg) contrast(0.95) brightness(0.92)',
    blend: 'normal',
    shadow: '0 var(--space-2) var(--space-6) rgba(0, 0, 0, 0.65)',
  },
  oled: {
    paper: '#000000',
    canvasFilter: 'invert(1) hue-rotate(180deg) contrast(1.08) brightness(0.96)',
    blend: 'normal',
    shadow: '0 var(--space-2) var(--space-6) rgba(0, 0, 0, 0.9)',
  },
};

export function getPdfThemeSurface(
  theme: ReadingTheme,
  colorMode?: 'match-theme' | 'original'
): PDFThemeSurface {
  if (colorMode === 'original') {
    return { ...PDF_THEME_MAP.day, canvasFilter: 'none', blend: 'normal' };
  }
  return PDF_THEME_MAP[theme] || PDF_THEME_MAP.night;
}

interface PDFViewerProps {
  data: ArrayBuffer;
  initialPage: number;
  currentPage: number;
  theme: ReadingTheme;
  settings: PDFViewSettings;
  onPageChange: (page: number, total: number) => void;
  onTOCLoaded: (items: TOCItem[]) => void;
  onToggleControls: () => void;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onError?: (message?: string) => void;
  interactionLockRef?: { current: boolean };
}

export default function PDFViewer({
  data,
  initialPage,
  currentPage,
  theme,
  settings,
  onPageChange,
  onTOCLoaded,
  onToggleControls,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onError,
  interactionLockRef,
}: PDFViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Concurrency and double-buffer state
  const isRenderingRef = useRef(false);
  const nextRenderPageRef = useRef<number | null>(null);
  const activeRenderTaskRef = useRef<any>(null);

  // Stable callback refs
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  const onTOCLoadedRef = useRef(onTOCLoaded);
  onTOCLoadedRef.current = onTOCLoaded;
  const onToggleControlsRef = useRef(onToggleControls);
  onToggleControlsRef.current = onToggleControls;
  const onPrevPageRef = useRef(onPrevPage);
  onPrevPageRef.current = onPrevPage;
  const onNextPageRef = useRef(onNextPage);
  onNextPageRef.current = onNextPage;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const interactionLockRefRef = useRef(interactionLockRef);
  interactionLockRefRef.current = interactionLockRef;

  const initialPageRef = useRef(initialPage);
  const hasReportedInitialPageRef = useRef(false);

  // Load PDF Document ONCE per data buffer
  useEffect(() => {
    if (error) return;
    let isMounted = true;
    setLoading(true);
    setError(false);

    const bufferCopy = data.slice(0);
    const loadTask = pdfjsLib.getDocument({ data: bufferCopy });

    loadTask.promise
      .then(async (doc) => {
        if (!isMounted) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setLoading(false);

        // Report initial page once upon document ready
        if (!hasReportedInitialPageRef.current) {
          hasReportedInitialPageRef.current = true;
          onPageChangeRef.current(initialPageRef.current, doc.numPages);
        }

        // Extract TOC Outline
        try {
          const outline = await doc.getOutline();
          if (outline && outline.length > 0) {
            const tocItems: TOCItem[] = [];
            for (const item of outline) {
              let targetPage: number | undefined;
              if (item.dest) {
                try {
                  const destRef =
                    typeof item.dest === 'string'
                      ? await doc.getDestination(item.dest)
                      : item.dest;
                  if (destRef && destRef[0]) {
                    const pageIndex = await doc.getPageIndex(destRef[0]);
                    targetPage = pageIndex + 1;
                  }
                } catch {}
              }
              tocItems.push({
                id: item.title,
                label: item.title,
                page: targetPage,
              });
            }
            onTOCLoadedRef.current(tocItems);
          }
        } catch (e) {
          console.warn('Could not extract PDF outline:', e);
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortException' || err?.message?.includes('aborted')) {
          return;
        }
        console.error('Error loading PDF document:', err);
        if (isMounted) {
          setError(true);
          setLoading(false);
          onErrorRef.current?.(undefined);
        }
      });

    return () => {
      isMounted = false;
      try {
        loadTask.destroy();
      } catch {}
    };
  }, [data, resetKey]);

  // Double-Buffered, Flicker-Free Single Page Render
  const renderSinglePage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc) return;
      if (pageNum < 1 || pageNum > pdfDoc.numPages) return;

      if (isRenderingRef.current) {
        nextRenderPageRef.current = pageNum;
        if (activeRenderTaskRef.current) {
          try {
            activeRenderTaskRef.current.cancel();
          } catch {}
        }
        return;
      }

      isRenderingRef.current = true;

      try {
        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;
        if (!canvas) {
          isRenderingRef.current = false;
          return;
        }

        const container = containerRef.current;
        const padX = 48;
        const padY = 140;
        const availWidth = Math.max(200, (container?.clientWidth || window.innerWidth) - padX);
        const availHeight = Math.max(200, (container?.clientHeight || window.innerHeight) - padY);

        const unscaledViewport = page.getViewport({ scale: 1.0 });

        let scale = 1.0;
        if (settings.zoomMode === 'fit-width') {
          scale = Math.min(3.5, availWidth / unscaledViewport.width);
        } else if (settings.zoomMode === 'fit-page') {
          const scaleW = availWidth / unscaledViewport.width;
          const scaleH = availHeight / unscaledViewport.height;
          scale = Math.min(scaleW, scaleH);
        } else {
          // Custom zoom relative to optimal fit
          const baseScale = Math.min(
            availWidth / unscaledViewport.width,
            availHeight / unscaledViewport.height
          );
          scale = baseScale * (settings.customZoom || 1.0);
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: scale * dpr });

        // Double buffer: Render into offscreen canvas first
        const offscreen = document.createElement('canvas');
        offscreen.width = viewport.width;
        offscreen.height = viewport.height;
        const offscreenCtx = offscreen.getContext('2d');
        if (!offscreenCtx) {
          isRenderingRef.current = false;
          return;
        }

        offscreenCtx.fillStyle = PDF_PAPER_WHITE;
        offscreenCtx.fillRect(0, 0, viewport.width, viewport.height);

        const renderContext = {
          canvas: offscreen,
          canvasContext: offscreenCtx,
          viewport,
        };

        const task = page.render(renderContext);
        activeRenderTaskRef.current = task;
        await task.promise;

        // Synchronously transfer completed buffer to visible canvas in 1 paint frame
        if (canvasRef.current) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / dpr}px`;
          canvas.style.height = `${viewport.height / dpr}px`;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(offscreen, 0, 0);
          }
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('PDF Render error:', err);
        }
      } finally {
        isRenderingRef.current = false;
        activeRenderTaskRef.current = null;
        if (nextRenderPageRef.current !== null) {
          const nextTarget = nextRenderPageRef.current;
          nextRenderPageRef.current = null;
          renderSinglePage(nextTarget);
        }
      }
    },
    [pdfDoc, settings.zoomMode, settings.customZoom]
  );

  // Render when in single page mode
  useEffect(() => {
    if (pdfDoc && currentPage && settings.scrollMode === 'single') {
      renderSinglePage(currentPage);
    }
  }, [pdfDoc, currentPage, settings.scrollMode, renderSinglePage]);

  // Window resize handler with debounce (single mode)
  useEffect(() => {
    if (settings.scrollMode !== 'single') return;

    let timeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (pdfDoc && currentPage) {
          renderSinglePage(currentPage);
        }
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [pdfDoc, currentPage, settings.scrollMode, renderSinglePage]);

  // Wheel zoom with Ctrl key (single mode)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || settings.scrollMode !== 'single') return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0 && onZoomIn) {
          onZoomIn();
        } else if (e.deltaY > 0 && onZoomOut) {
          onZoomOut();
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [onZoomIn, onZoomOut, settings.scrollMode]);

  // Keyboard navigation (single mode)
  useEffect(() => {
    if (settings.scrollMode !== 'single') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (interactionLockRefRef.current?.current) return;
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        if (currentPage < totalPages) {
          if (onNextPageRef.current) {
            onNextPageRef.current();
          } else {
            onPageChangeRef.current(currentPage + 1, totalPages);
          }
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        if (currentPage > 1) {
          if (onPrevPageRef.current) {
            onPrevPageRef.current();
          } else {
            onPageChangeRef.current(currentPage - 1, totalPages);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, settings.scrollMode]);

  // ReadEra-style Tap zones in single mode
  const handleSingleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (interactionLockRefRef.current?.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;

    if (ratio < 0.25) {
      if (currentPage > 1) {
        if (onPrevPageRef.current) {
          onPrevPageRef.current();
        } else {
          onPageChangeRef.current(currentPage - 1, totalPages);
        }
      }
    } else if (ratio > 0.75) {
      if (currentPage < totalPages) {
        if (onNextPageRef.current) {
          onNextPageRef.current();
        } else {
          onPageChangeRef.current(currentPage + 1, totalPages);
        }
      }
    } else {
      onToggleControlsRef.current();
    }
  };

  const handleRetry = useCallback(() => {
    setResetKey((k) => k + 1);
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingOverlay} role="status" aria-live="polite">
        <div className={styles.loadingBadge}>
          <BookOpen size={24} className={styles.loadingBookIcon} aria-hidden="true" />
          <span className={styles.loadingBadgeRing} />
        </div>
        <span className={styles.loadingText}>Opening your book&hellip;</span>
        <div className={styles.loadingSkeleton} aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.singleContainer} ${styles.stateWrap}`}>
        <div className={styles.errorBadge}>
          <BookX size={24} aria-hidden="true" />
        </div>
        <h1 className={styles.stateTitle}>Couldn&apos;t open this book</h1>
        <p className={styles.stateMessage}>
          This book could not be opened. The file may be corrupted or missing.
        </p>
        <div className={styles.stateActions}>
          <a href="/" className={styles.primaryAction}>
            Go to Library
          </a>
          <button type="button" onClick={handleRetry} className={styles.secondaryAction}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  // 1. Continuous Pages Mode
  if (settings.scrollMode === 'continuous' && pdfDoc) {
    return (
      <PDFContinuousView
        pdfDoc={pdfDoc}
        currentPage={currentPage}
        totalPages={totalPages}
        theme={theme}
        settings={settings}
        onPageChange={onPageChange}
        onToggleControls={onToggleControls}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />
    );
  }

  // 2. Single Page Mode
  const surface = getPdfThemeSurface(theme, settings.colorMode);

  return (
    <div
      ref={containerRef}
      className={styles.singleContainer}
      data-theme={theme}
      onClick={handleSingleContainerClick}
    >
      <div
        className={styles.pageWrapper}
        style={{
          background: surface.paper,
          boxShadow: surface.shadow,
        }}
      >
        <canvas
          ref={canvasRef}
          className={styles.pdfCanvas}
          style={{ filter: surface.canvasFilter, mixBlendMode: surface.blend }}
        />
      </div>
    </div>
  );
}
