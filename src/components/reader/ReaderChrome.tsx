'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ListTree,
  Bookmark as BookmarkIcon,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import styles from './ReaderChrome.module.css';

interface ReaderChromeProps {
  visible: boolean;
  bookTitle: string;
  chapterTitle?: string;
  currentPage: number;
  totalPages: number;
  percent: number;
  isBookmarked: boolean;
  zoomDisplay?: string;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onToggleBookmark: () => void;
  onOpenTOC: () => void;
  onOpenBookmarks: () => void;
  onOpenSettings: () => void;
  onPageChange: (newPage: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export default function ReaderChrome({
  visible,
  bookTitle,
  chapterTitle,
  currentPage,
  totalPages,
  isBookmarked,
  zoomDisplay,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onToggleBookmark,
  onOpenTOC,
  onOpenBookmarks,
  onOpenSettings,
  onPageChange,
  onPrevPage,
  onNextPage,
}: ReaderChromeProps) {
  // Local slider state so scrubbing is buttery smooth without choking render threads
  const [sliderVal, setSliderVal] = useState(currentPage);
  const isDraggingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const maxPage = Math.max(1, totalPages);

  // Sync with external currentPage only when not actively dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      setSliderVal(currentPage);
    }
  }, [currentPage]);

  const handleSliderChange = (val: number) => {
    setSliderVal(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onPageChange(val);
    }, 90);
  };

  const handleSliderCommit = () => {
    isDraggingRef.current = false;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    onPageChange(sliderVal);
  };

  const displayPage = isDraggingRef.current ? sliderVal : currentPage;
  const displayPercent = Math.min(
    100,
    Math.round((displayPage / maxPage) * 100)
  );

  return (
    <>
      {/* Top Bar */}
      <header
        className={`${styles.topBar} ${!visible ? styles.hidden : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.leftGroup}>
          <Link href="/" className={styles.backBtn} title="Back to Library" aria-label="Back to Library">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <div className={styles.titleArea}>
            <span className={styles.bookTitle} title={bookTitle}>
              {bookTitle}
            </span>
            {chapterTitle && (
              <span className={styles.chapterTitle} title={chapterTitle}>
                {chapterTitle}
              </span>
            )}
          </div>
        </div>

        <nav className={styles.rightGroup} aria-label="Reader controls">
          <button
            onClick={onToggleBookmark}
            className={`${styles.actionBtn} ${isBookmarked ? styles.bookmarked : ''}`}
            title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Page'}
            aria-label={isBookmarked ? 'Remove Bookmark' : 'Bookmark Page'}
            aria-pressed={isBookmarked}
          >
            <BookmarkIcon size={20} aria-hidden="true" fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={onOpenBookmarks}
            className={styles.actionBtn}
            title="Saved Bookmarks & Notes"
            aria-label="Bookmarks"
          >
            <BookmarkIcon size={20} aria-hidden="true" />
          </button>
          <button
            onClick={onOpenTOC}
            className={styles.actionBtn}
            title="Table of Contents"
            aria-label="Contents"
          >
            <ListTree size={20} aria-hidden="true" />
          </button>
          <button
            onClick={onOpenSettings}
            className={styles.actionBtn}
            title="Reader Settings"
            aria-label="Reader Settings"
          >
            <SettingsIcon size={20} aria-hidden="true" />
          </button>
        </nav>
      </header>

      {/* Bottom Bar */}
      <footer
        className={`${styles.bottomBar} ${!visible ? styles.hidden : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.scrubberRow}>
          <input
            type="range"
            min={1}
            max={maxPage}
            value={sliderVal}
            aria-label="Page"
            aria-valuemin={1}
            aria-valuemax={maxPage}
            aria-valuenow={sliderVal}
            aria-valuetext={`Page ${sliderVal} of ${maxPage}`}
            onMouseDown={() => {
              isDraggingRef.current = true;
            }}
            onTouchStart={() => {
              isDraggingRef.current = true;
            }}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            onMouseUp={handleSliderCommit}
            onTouchEnd={handleSliderCommit}
            onKeyUp={handleSliderCommit}
            style={{ '--page-fill': `${displayPercent}%` } as React.CSSProperties}
            className={styles.pageSlider}
          />
        </div>

        <div className={styles.bottomInfoRow}>
          <div className={styles.pageControls}>
            <button
              onClick={onPrevPage}
              disabled={currentPage <= 1}
              className={styles.navArrowBtn}
              title="Previous Page (Left Arrow)"
              aria-label="Previous Page"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              <span>Prev</span>
            </button>
            <button
              onClick={onNextPage}
              disabled={currentPage >= maxPage}
              className={styles.navArrowBtn}
              title="Next Page (Right Arrow)"
              aria-label="Next Page"
            >
              <span>Next</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Zoom Controls */}
          {onZoomIn && onZoomOut && (
            <div className={styles.zoomControls} aria-label="Zoom controls">
              <button
                onClick={onZoomOut}
                className={styles.zoomBtn}
                title="Zoom Out (-)"
                aria-label="Zoom Out"
              >
                <ZoomOut size={18} aria-hidden="true" />
              </button>
              <button
                onClick={onZoomReset}
                className={styles.zoomLabelBtn}
                title="Click to reset zoom (0)"
                aria-label={`Reset zoom, current ${zoomDisplay || 'Fit'}`}
              >
                <span>{zoomDisplay || 'Fit'}</span>
              </button>
              <button
                onClick={onZoomIn}
                className={styles.zoomBtn}
                title="Zoom In (+)"
                aria-label="Zoom In"
              >
                <ZoomIn size={18} aria-hidden="true" />
              </button>
            </div>
          )}

          <div>
            <p className={styles.pageInfo} aria-live="polite">
              Page {displayPage} of {totalPages} ({displayPercent}%)
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
