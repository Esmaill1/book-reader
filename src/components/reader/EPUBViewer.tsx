'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import ePub, { Book as EPubBook, Rendition } from 'epubjs';
import { TypographySettings, ReadingTheme } from '@/types';
import { TOCItem } from './TOCDrawer';
import { BookOpen, BookX } from 'lucide-react';
import styles from './EPUBViewer.module.css';

export const EPUB_THEME_FALLBACK: Record<
  ReadingTheme,
  { color: string; bg: string }
> = {
  day: { color: '#1e2621', bg: '#f7f4ec' },
  sepia: { color: '#33261a', bg: '#f3e8d2' },
  night: { color: '#ece5d3', bg: '#141a17' },
  oled: { color: '#ece5d3', bg: '#000000' },
};

// Reads the live theme palette from globals.css (:root data-theme) so the
// rendition preview always matches the app chrome. Temporarily swaps the
// data-theme attribute when it differs from the requested theme.
export function getEPUBThemeColors(theme: ReadingTheme): {
  color: string;
  bg: string;
} {
  const fallback = EPUB_THEME_FALLBACK[theme] || EPUB_THEME_FALLBACK.night;
  if (typeof document === 'undefined') return fallback;

  const docEl = document.documentElement;
  const previousTheme = docEl.getAttribute('data-theme');
  if (previousTheme !== theme) {
    docEl.setAttribute('data-theme', theme);
  }

  try {
    const computed = getComputedStyle(docEl);
    const readVar = (name: string, fb: string) => {
      const v = computed.getPropertyValue(name).trim();
      return v || fb;
    };
    return {
      color: readVar('--text-main', fallback.color),
      bg: readVar('--bg-main', fallback.bg),
    };
  } catch {
    return fallback;
  } finally {
    if (previousTheme && previousTheme !== theme) {
      docEl.setAttribute('data-theme', previousTheme);
    }
  }
}

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
  onError?: (message?: string) => void;
  interactionLockRef?: { current: boolean };
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
  onError,
  interactionLockRef,
}: EPUBViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<EPubBook | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // Keep references to dynamic callbacks & initial values so book instance is never destroyed on state update
  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;
  const onTOCLoadedRef = useRef(onTOCLoaded);
  onTOCLoadedRef.current = onTOCLoaded;
  const onToggleControlsRef = useRef(onToggleControls);
  onToggleControlsRef.current = onToggleControls;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const interactionLockRefRef = useRef(interactionLockRef);
  interactionLockRefRef.current = interactionLockRef;

  const initialCfiRef = useRef(initialCfi);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const typographyRef = useRef(typography);
  typographyRef.current = typography;

  const fail = useCallback(() => {
    setError(true);
    setLoading(false);
    onErrorRef.current?.(undefined);
  }, []);

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

      let marginPadding = '0 var(--space-6)';
      if (currentTypo.margin === 'narrow') marginPadding = '0 var(--space-2)';
      if (currentTypo.margin === 'wide') marginPadding = '0 var(--space-12)';

      const { color, bg } = getEPUBThemeColors(currentTheme);

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
    if (!containerRef.current || error) return;
    let isMounted = true;
    setLoading(true);
    setError(false);

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
          if (isMounted) fail();
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
        if (interactionLockRefRef.current?.current) return;
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
          rendition.next();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
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
      if (isMounted) fail();
    }
  }, [data, applyStylesToRendition, resetKey]);

  const handleRetry = useCallback(() => {
    setResetKey((k) => k + 1);
  }, []);

  if (error) {
    return (
      <div className={`${styles.wrapper} ${styles.stateWrap}`}>
        <div className={styles.errorBadge}>
          <BookX size={24} />
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

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.loadingOverlay}
        style={loading ? undefined : { display: 'none' }}
        role="status"
        aria-live="polite"
      >
        <div className={styles.loadingBadge}>
          <BookOpen size={22} className={styles.loadingBookIcon} />
          <span className={styles.loadingBadgeRing} />
        </div>
        <span className={styles.loadingText}>Opening your book&hellip;</span>
      </div>
      <div
        ref={containerRef}
        className={styles.viewerContainer}
        style={{ opacity: loading ? 0 : 1 }}
      />
    </div>
  );
}
