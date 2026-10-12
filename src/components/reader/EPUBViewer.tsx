'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import ePub, { Book as EPubBook, Rendition } from 'epubjs';
import { TypographySettings, ReadingTheme } from '@/types';
import { TOCItem } from './TOCDrawer';
import { Loader2 } from 'lucide-react';
import styles from './EPUBViewer.module.css';

interface EPUBViewerProps {
  data: ArrayBuffer;
  initialCfi?: string;
  theme: ReadingTheme;
  typography: TypographySettings;
  onLocationChange: (cfi: string, percent: number, page: number, total: number) => void;
  onTOCLoaded: (items: TOCItem[]) => void;
  onToggleControls: () => void;
  onNextRef?: React.MutableRefObject<(() => void) | null>;
  onPrevRef?: React.MutableRefObject<(() => void) | null>;
}

export default function EPUBViewer({
  data,
  initialCfi,
  theme,
  typography,
  onLocationChange,
  onTOCLoaded,
  onToggleControls,
  onNextRef,
  onPrevRef,
}: EPUBViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<EPubBook | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [loading, setLoading] = useState(true);

  // Expose next/prev page methods to parent
  useEffect(() => {
    if (onNextRef) {
      onNextRef.current = () => renditionRef.current?.next();
    }
    if (onPrevRef) {
      onPrevRef.current = () => renditionRef.current?.prev();
    }
  }, [onNextRef, onPrevRef]);

  // Apply styles & themes to Rendition
  const applyStyles = useCallback(() => {
    if (!renditionRef.current) return;
    const rendition = renditionRef.current;

    let fontFam = 'var(--font-sans)';
    if (typography.fontFamily === 'serif') fontFam = 'var(--font-serif)';
    if (typography.fontFamily === 'cairo') fontFam = "'Cairo', Tahoma, sans-serif";
    if (typography.fontFamily === 'amiri') fontFam = "'Amiri', Georgia, serif";

    let marginPadding = '0 24px';
    if (typography.margin === 'narrow') marginPadding = '0 8px';
    if (typography.margin === 'wide') marginPadding = '0 48px';

    let color = '#e2e8f0';
    let bg = '#181c24';

    if (theme === 'day') {
      color = '#0f172a';
      bg = '#f8fafc';
    } else if (theme === 'sepia') {
      color = '#4a3824';
      bg = '#fbf0d9';
    } else if (theme === 'oled') {
      color = '#e5e7eb';
      bg = '#000000';
    }

    rendition.themes.default({
      body: {
        color: `${color} !important`,
        background: `${bg} !important`,
        'font-family': `${fontFam} !important`,
        'font-size': `${typography.fontSize}px !important`,
        'line-height': `${typography.lineHeight} !important`,
        padding: `${marginPadding} !important`,
      },
      p: {
        'line-height': `${typography.lineHeight} !important`,
      },
    });
  }, [theme, typography]);

  useEffect(() => {
    applyStyles();
  }, [applyStyles]);

  // Initialize EPUB Book & Rendition
  useEffect(() => {
    if (!containerRef.current) return;
    let isMounted = true;
    setLoading(true);

    try {
      const book = ePub(data);
      bookRef.current = book;

      const rendition = book.renderTo(containerRef.current, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'none',
      });
      renditionRef.current = rendition;

      book.ready
        .then(() => {
          if (!isMounted) return;

          // Extract TOC
          const toc = (book as any).navigation?.toc || [];
          const tocItems: TOCItem[] = toc.map((t: any) => ({
            id: t.id || t.href,
            label: t.label?.trim() || 'Chapter',
            href: t.href,
          }));
          onTOCLoaded(tocItems);

          // Generate locations for percentage calculation
          return book.locations.generate(1024);
        })
        .then(() => {
          if (!isMounted) return;
          setLoading(false);
          applyStyles();

          // Display initial CFI or start
          rendition.display(initialCfi || undefined);
        })
        .catch((e) => {
          console.warn('Error rendering EPUB:', e);
          if (isMounted) setLoading(false);
        });

      // Location changed event
      rendition.on('relocated', (location: any) => {
        if (!isMounted) return;
        const cfi = location.start.cfi;
        const percent = Math.round((book.locations.percentageFromCfi(cfi) || 0) * 100);
        const total = (book.locations as any).total || 100;
        const currentLoc = (book.locations as any).locationFromCfi(cfi) || 1;

        onLocationChange(cfi, percent, currentLoc, total);
      });

      // Click to toggle controls
      rendition.on('click', () => {
        onToggleControls();
      });

      // Keyboard navigation
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
          rendition.next();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          rendition.prev();
        }
      };
      window.addEventListener('keydown', handleKey);

      return () => {
        isMounted = false;
        window.removeEventListener('keydown', handleKey);
        try {
          book.destroy();
        } catch {}
      };
    } catch (err) {
      console.error('Failed to initialize EPUB:', err);
      setLoading(false);
    }
  }, [data, initialCfi, applyStyles, onLocationChange, onTOCLoaded, onToggleControls]);

  return (
    <div className={styles.wrapper}>
      {loading && (
        <div className={styles.loadingOverlay}>
          <Loader2 size={36} className={styles.spinner} />
          <span>Opening EPUB book...</span>
        </div>
      )}
      <div
        ref={containerRef}
        className={styles.viewerContainer}
        style={{ display: loading ? 'none' : 'block' }}
      />
    </div>
  );
}
