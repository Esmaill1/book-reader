'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { PDFViewSettings } from '@/types';
import { TOCItem } from './TOCDrawer';
import { Loader2 } from 'lucide-react';
import styles from './PDFViewer.module.css';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface PDFViewerProps {
  data: ArrayBuffer;
  initialPage: number;
  currentPage: number;
  settings: PDFViewSettings;
  onPageChange: (page: number, total: number) => void;
  onTOCLoaded: (items: TOCItem[]) => void;
  onToggleControls: () => void;
  onPrevPage?: () => void;
  onNextPage?: () => void;
}

export default function PDFViewer({
  data,
  initialPage,
  currentPage,
  settings,
  onPageChange,
  onTOCLoaded,
  onToggleControls,
  onPrevPage,
  onNextPage,
}: PDFViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

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

  const initialPageRef = useRef(initialPage);
  const hasReportedInitialPageRef = useRef(false);

  // Load PDF Document ONCE per data buffer - NEVER reload on page turn
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

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
                  const destRef = typeof item.dest === 'string' ? await doc.getDestination(item.dest) : item.dest;
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
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      try {
        loadTask.destroy();
      } catch {}
    };
  }, [data]);

  // Double-Buffered, Flicker-Free Page Render
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc) return;
      if (pageNum < 1 || pageNum > pdfDoc.numPages) return;

      // If already rendering, queue up target page and cancel current render task
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

        // Calculate available dimensions from container
        const container = containerRef.current;
        const padX = 32;
        const padY = 140;
        const availWidth = Math.max(200, (container?.clientWidth || window.innerWidth) - padX);
        const availHeight = Math.max(200, (container?.clientHeight || window.innerHeight) - padY);

        const unscaledViewport = page.getViewport({ scale: 1.0 });

        let scale = 1.0;
        if (settings.zoomMode === 'fit-width') {
          scale = Math.min(3.0, availWidth / unscaledViewport.width);
        } else if (settings.zoomMode === 'fit-page') {
          const scaleW = availWidth / unscaledViewport.width;
          const scaleH = availHeight / unscaledViewport.height;
          scale = Math.min(scaleW, scaleH);
        } else {
          scale = settings.customZoom || 1.0;
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

        offscreenCtx.fillStyle = '#ffffff';
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
          renderPage(nextTarget);
        }
      }
    },
    [pdfDoc, settings.zoomMode, settings.customZoom]
  );

  // Render when currentPage or settings change
  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, renderPage]);

  // Window resize handler with debounce
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (pdfDoc && currentPage) {
          renderPage(currentPage);
        }
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [pdfDoc, currentPage, renderPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        if (currentPage < totalPages) {
          if (onNextPageRef.current) {
            onNextPageRef.current();
          } else {
            onPageChangeRef.current(currentPage + 1, totalPages);
          }
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
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
  }, [currentPage, totalPages]);

  // ReadEra-style Tap zones: Left 25% prev, Right 25% next, Center toggle chrome
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
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

  return (
    <div
      ref={containerRef}
      className={styles.singleContainer}
      onClick={handleContainerClick}
    >
      {loading && (
        <div className={styles.loadingOverlay}>
          <Loader2 size={36} className={styles.spinner} />
          <span>Opening PDF document...</span>
        </div>
      )}
      <div
        className={styles.pageWrapper}
        style={{ display: loading ? 'none' : 'block' }}
      >
        <canvas ref={canvasRef} className={styles.pdfCanvas} />
      </div>
    </div>
  );
}
