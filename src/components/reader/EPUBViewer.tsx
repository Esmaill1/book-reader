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

  // Keep references to dynamic callbacks & initial values so book instance is never destroyed on state update
  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;
  const onTOCLoadedRef = useRef(onTOCLoaded);
  onTOCLoadedRef.current = onTOCLoaded;
  const onToggleControlsRef = useRef(onToggleControls);
  onToggleControlsRef.current = onToggleControls;

  const initialCfiRef = useRef(initialCfi);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const typographyRef = useRef(typography);
  typographyRef.current = typography;

  // Expose next/prev page methods to parent
  useEffect(() => {
    if (onNextRef) {
      onNextRef.current = () => renditionRef.current?.next();
    }
    if (onPrevRef) {
      onPrevRef.current = () => renditionRef.current?.prev();
    }
  }, [onNextRef, onPrevRef]);

  // Apply styling dynamically to the existing Rendition
  const applyStylesToRendition = useCallback(
    (rendition: Rendition, currentTheme: ReadingTheme, currentTypo: TypographySettings) => {
      let fontFam = 'var(--font-sans)';
      if (currentTypo.fontFamily === 'serif') fontFam = 'var(--font-serif)';
      if (currentTypo.fontFamily === 'cairo') fontFam = "'Cairo', Tahoma, sans-serif";
      if (currentTypo.fontFamily === 'amiri') fontFam = "'Amiri', Georgia, serif";

      let marginPadding = '0 24px';
      if (currentTypo.margin === 'narrow') marginPadding = '0 8px';
      if (currentTypo.margin === 'wide') marginPadding = '0 48px';

      let color = '#e2e8f0';
      let bg = '#181c24';

      if (currentTheme === 'day') {
        color = '#0f172a';
        bg = '#f8fafc';
      } else if (currentTheme === 'sepia') {
        color = '#4a3824';
        bg = '#fbf0d9';
      } else if (currentTheme === 'oled') {
        color = '#e5e7eb';
        bg = '#000000';
      }

      rendition.themes.default({
        body: {
          color: `${color} !important`,
          background: `${bg} !important`,
          'font-family': `${fontFam} !important`,
          'font-size': `${currentTypo.fontSize}px !important`,
          'line-height': `${currentTypo.lineHeight} !important`,
          padding: `${marginPadding} !important`,
        },
        p: {
          'line-height': `${currentTypo.lineHeight} !important`,
        },
      });
    },
    []
  );

  // Dynamically update theme/typography without restarting EPUB
  useEffect(() => {
    if (renditionRef.current) {
      applyStylesToRendition(renditionRef.current, theme, typography);
    }
  }, [theme, typography, applyStylesToRendition]);

  // Initialize EPUB Book & Rendition ONCE per data buffer
  useEffect(() => {
    if (!containerRef.current) return;
    let isMounted = true;
    setLoading(true);

    let book: EPubBook | null = null;

    try {
      const bufferCopy = data.slice(0);
      book = ePub(bufferCopy);
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
          onTOCLoadedRef.current(tocItems);

          // Generate locations for reading percentage calculation
          return book!.locations.generate(1024);
        })
        .then(() => {
          if (!isMounted) return;
          setLoading(false);
          applyStylesToRendition(rendition, themeRef.current, typographyRef.current);

          // Display initial CFI or start from beginning
          rendition.display(initialCfiRef.current || undefined);
        })
        .catch((e) => {
          console.warn('Error rendering EPUB:', e);
          if (isMounted) setLoading(false);
        });

      // Location changed event
      rendition.on('relocated', (location: any) => {
        if (!isMounted) return;
        const cfi = location.start.cfi;
        const percent = Math.round((book!.locations.percentageFromCfi(cfi) || 0) * 100);
        const total = (book!.locations as any).total || 100;
        const currentLoc = (book!.locations as any).locationFromCfi(cfi) || 1;

        onLocationChangeRef.current(cfi, percent, currentLoc, total);
      });

      // Tap / Click handling inside EPUB iframe (ReadEra tap zones)
      rendition.on('click', (e: MouseEvent) => {
        const width = window.innerWidth;
        const x = e.clientX;
        const ratio = x / width;
        if (ratio < 0.25) {
          rendition.prev();
        } else if (ratio > 0.75) {
          rendition.next();
        } else {
          onToggleControlsRef.current();
        }
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
          book?.destroy();
        } catch {}
      };
    } catch (err) {
      console.error('Failed to initialize EPUB:', err);
      setLoading(false);
    }
  }, [data, applyStylesToRendition]);

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
        style={{ opacity: loading ? 0 : 1 }}
      />
    </div>
  );
}
