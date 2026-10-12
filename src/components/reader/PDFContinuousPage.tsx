'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { ReadingTheme } from '@/types';
import { getPdfThemeSurface, PDF_PAPER_WHITE } from './PDFViewer';
import styles from './PDFViewer.module.css';

interface PDFContinuousPageProps {
  doc: PDFDocumentProxy;
  pageNum: number;
  width: number;
  height: number;
  scale: number;
  theme: ReadingTheme;
  colorMode?: 'match-theme' | 'original';
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onToggleControls: () => void;
}

export default function PDFContinuousPage({
  doc,
  pageNum,
  width,
  height,
  scale,
  theme,
  colorMode,
  scrollContainerRef,
  onToggleControls,
}: PDFContinuousPageProps) {
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const isRenderingRef = useRef(false);

  // Lazy rendering observer: activate rendering 800px before scrolling into view, unload when far away
  useEffect(() => {
    const el = pageContainerRef.current;
    const root = scrollContainerRef.current;
    if (!el || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setShouldRender(true);
        } else {
          setShouldRender(false);
          setIsRendered(false);
        }
      },
      {
        root,
        rootMargin: '800px 0px 800px 0px',
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollContainerRef]);

  // Render page canvas when shouldRender is true
  useEffect(() => {
    if (!shouldRender || !canvasRef.current) return;
    let isCancelled = false;
    let renderTask: any = null;

    async function renderPageContent() {
      if (isRenderingRef.current) return;
      isRenderingRef.current = true;

      try {
        const page = await doc.getPage(pageNum);
        if (isCancelled || !canvasRef.current) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: scale * dpr });

        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = PDF_PAPER_WHITE;
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        const task = page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        });
        renderTask = task;
        await task.promise;

        if (!isCancelled) {
          setIsRendered(true);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`Continuous render error on page ${pageNum}:`, err);
        }
      } finally {
        isRenderingRef.current = false;
      }
    }

    renderPageContent();

    return () => {
      isCancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {}
      }
    };
  }, [doc, pageNum, scale, shouldRender]);

  const surface = getPdfThemeSurface(theme, colorMode);

  return (
    <div
      id={`pdf-page-${pageNum}`}
      ref={pageContainerRef}
      data-page-num={pageNum}
      className={styles.continuousPageItem}
      style={{
        width: `${Math.round(width)}px`,
        height: `${Math.round(height)}px`,
        background: surface.paper,
        boxShadow: surface.shadow,
      }}
      onClick={onToggleControls}
    >
      <canvas
        ref={canvasRef}
        className={styles.pdfCanvas}
        style={{
          display: shouldRender && isRendered ? 'block' : 'none',
          filter: surface.canvasFilter,
          mixBlendMode: surface.blend,
        }}
      />
      {(!shouldRender || !isRendered) && (
        <div className={styles.continuousPlaceholder} aria-hidden="true">
          {shouldRender && !isRendered && <span className={styles.placeholderShimmer} />}
          <span className={styles.continuousPlaceholderText}>Page {pageNum}</span>
        </div>
      )}
    </div>
  );
}
