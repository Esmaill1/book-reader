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
  settings: PDFViewSettings;
  onPageChange: (page: number, total: number) => void;
  onTOCLoaded: (items: TOCItem[]) => void;
  onToggleControls: () => void;
  currentPage: number;
}

export default function PDFViewer({
  data,
  initialPage,
  settings,
  onPageChange,
  onTOCLoaded,
  onToggleControls,
  currentPage,
}: PDFViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  // Load PDF Document
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    // Create a copy of ArrayBuffer because PDF.js transfers and detaches the buffer to the worker
    const bufferCopy = data.slice(0);
    const loadTask = pdfjsLib.getDocument({ data: bufferCopy });
    loadTask.promise
      .then(async (doc) => {
        if (!isMounted) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setLoading(false);

        // Report initial page
        onPageChange(initialPage, doc.numPages);

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
            onTOCLoaded(tocItems);
          }
        } catch (e) {
          console.warn('Could not extract PDF outline:', e);
        }
      })
      .catch((err) => {
        console.error('Error loading PDF:', err);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [data, initialPage, onPageChange, onTOCLoaded]);

  // Render Current Page
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate responsive viewport scale
        const containerWidth =
          (containerRef.current?.clientWidth || window.innerWidth) - 32;
        const containerHeight =
          (containerRef.current?.clientHeight || window.innerHeight) - 140;

        const unscaledViewport = page.getViewport({ scale: 1.0 });

        let scale = 1.0;
        if (settings.zoomMode === 'fit-width') {
          scale = Math.min(2.5, containerWidth / unscaledViewport.width);
        } else if (settings.zoomMode === 'fit-page') {
          const scaleW = containerWidth / unscaledViewport.width;
          const scaleH = containerHeight / unscaledViewport.height;
          scale = Math.min(scaleW, scaleH);
        } else {
          scale = settings.customZoom || 1.0;
        }

        // Apply device pixel ratio for sharp text on Retina/AMOLED screens
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: scale * dpr });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        const renderContext = {
          canvas,
          canvasContext: ctx,
          viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('PDF Render error:', err);
        }
      }
    },
    [pdfDoc, settings.zoomMode, settings.customZoom]
  );

  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, renderPage]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (pdfDoc && currentPage) {
        renderPage(currentPage);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pdfDoc, currentPage, renderPage]);

  // Handle keyboard arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        if (currentPage < totalPages) {
          onPageChange(currentPage + 1, totalPages);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (currentPage > 1) {
          onPageChange(currentPage - 1, totalPages);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, onPageChange]);

  if (loading) {
    return (
      <div className={styles.loadingOverlay}>
        <Loader2 size={36} className={styles.spinner} />
        <span>Loading PDF document...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={styles.singleContainer}
      onClick={onToggleControls}
    >
      <div className={styles.pageWrapper}>
        <canvas ref={canvasRef} className={styles.pdfCanvas} />
      </div>
    </div>
  );
}
