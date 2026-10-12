'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { PDFViewSettings, ReadingTheme } from '@/types';
import PDFContinuousPage from './PDFContinuousPage';
import styles from './PDFViewer.module.css';

interface PDFContinuousViewProps {
  pdfDoc: PDFDocumentProxy;
  currentPage: number;
  totalPages: number;
  theme: ReadingTheme;
  settings: PDFViewSettings;
  onPageChange: (page: number, total: number) => void;
  onToggleControls: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export default function PDFContinuousView({
  pdfDoc,
  currentPage,
  totalPages,
  theme,
  settings,
  onPageChange,
  onToggleControls,
  onZoomIn,
  onZoomOut,
}: PDFContinuousViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [baseDimensions, setBaseDimensions] = useState<{ width: number; height: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  });

  const isProgrammaticScrollRef = useRef(false);
  const lastReportedPageRef = useRef(currentPage);
  const initialScrollDoneRef = useRef(false);
  const prevScaleRef = useRef<number | null>(null);

  // 1. Measure base page aspect ratio from page 1
  useEffect(() => {
    let isMounted = true;
    async function measure() {
      try {
        const page1 = await pdfDoc.getPage(1);
        const unscaled = page1.getViewport({ scale: 1.0 });
        if (isMounted) {
          setBaseDimensions({
            width: unscaled.width,
            height: unscaled.height,
          });
        }
      } catch (err) {
        console.warn('Error measuring base PDF dimensions:', err);
      }
    }
    measure();
    return () => {
      isMounted = false;
    };
  }, [pdfDoc]);

  // 2. Track container size accurately on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // 3. Compute scale and page dimensions based on settings and container size
  const availWidth = Math.max(200, containerSize.width - 48);
  const availHeight = Math.max(200, containerSize.height - 140);

  let scale = 1.0;
  if (baseDimensions) {
    if (settings.zoomMode === 'fit-width') {
      scale = Math.min(3.5, availWidth / baseDimensions.width);
    } else if (settings.zoomMode === 'fit-page') {
      const scaleW = availWidth / baseDimensions.width;
      const scaleH = availHeight / baseDimensions.height;
      scale = Math.min(scaleW, scaleH);
    } else {
      const baseScale = Math.min(availWidth / baseDimensions.width, availHeight / baseDimensions.height);
      scale = baseScale * (settings.customZoom || 1.0);
    }
  }

  const pageWidth = (baseDimensions?.width || 612) * scale;
  const pageHeight = (baseDimensions?.height || 792) * scale;

  // 4. Initial scroll to current page on mount
  useEffect(() => {
    if (initialScrollDoneRef.current) return;
    if (!baseDimensions) return;

    const timer = setTimeout(() => {
      const targetEl = document.getElementById(`pdf-page-${currentPage}`);
      const container = containerRef.current;
      if (targetEl && container) {
        initialScrollDoneRef.current = true;
        if (currentPage > 1) {
          isProgrammaticScrollRef.current = true;
          const targetTop = targetEl.offsetTop - 72;
          container.scrollTop = Math.max(0, targetTop);
          setTimeout(() => {
            isProgrammaticScrollRef.current = false;
          }, 350);
        }
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [baseDimensions, currentPage]);

  // 5. Scroll to target page when currentPage changes externally (scrubber, TOC, bookmark)
  useEffect(() => {
    if (isProgrammaticScrollRef.current) return;
    if (lastReportedPageRef.current === currentPage) return;

    const targetEl = document.getElementById(`pdf-page-${currentPage}`);
    const container = containerRef.current;
    if (targetEl && container) {
      isProgrammaticScrollRef.current = true;
      lastReportedPageRef.current = currentPage;

      const targetTop = targetEl.offsetTop - 72;
      container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });

      const timer = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentPage]);

  // 6. Anchor scroll position when zoom scale changes
  useEffect(() => {
    if (prevScaleRef.current === null) {
      prevScaleRef.current = scale;
      return;
    }

    if (prevScaleRef.current !== scale) {
      prevScaleRef.current = scale;
      const targetEl = document.getElementById(`pdf-page-${currentPage}`);
      const container = containerRef.current;
      if (targetEl && container) {
        isProgrammaticScrollRef.current = true;
        const targetTop = targetEl.offsetTop - 72;
        container.scrollTop = Math.max(0, targetTop);
        const timer = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [scale, currentPage]);

  // 7. Track active page while scrolling using container viewport center
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;

    const onScroll = () => {
      if (isProgrammaticScrollRef.current) return;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const scrollTop = container.scrollTop;
        const containerMid = scrollTop + container.clientHeight / 2;

        const pageEls = container.querySelectorAll<HTMLElement>('[data-page-num]');
        if (!pageEls.length) return;

        let activePage = 1;
        for (let i = 0; i < pageEls.length; i++) {
          const el = pageEls[i];
          const top = el.offsetTop;
          const bottom = top + el.offsetHeight;

          if (containerMid >= top && containerMid <= bottom) {
            activePage = parseInt(el.getAttribute('data-page-num') || '1', 10);
            break;
          } else if (containerMid < top) {
            activePage = Math.max(1, parseInt(el.getAttribute('data-page-num') || '1', 10) - 1);
            break;
          } else {
            activePage = parseInt(el.getAttribute('data-page-num') || '1', 10);
          }
        }

        if (activePage !== lastReportedPageRef.current && activePage >= 1 && activePage <= totalPages) {
          lastReportedPageRef.current = activePage;
          onPageChange(activePage, totalPages);
        }
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [totalPages, onPageChange]);

  // 8. Ctrl + Wheel Zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

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
  }, [onZoomIn, onZoomOut]);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div
      ref={containerRef}
      className={styles.continuousContainer}
      data-theme={theme}
      onClick={onToggleControls}
    >
      <div
        className={styles.continuousScrollColumn}
        onClick={(e) => e.stopPropagation()}
      >
        {pageNumbers.map((p) => (
          <PDFContinuousPage
            key={p}
            doc={pdfDoc}
            pageNum={p}
            width={pageWidth}
            height={pageHeight}
            scale={scale}
            theme={theme}
            colorMode={settings.colorMode}
            scrollContainerRef={containerRef}
            onToggleControls={onToggleControls}
          />
        ))}
      </div>
    </div>
  );
}
