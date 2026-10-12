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
  percent,
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
    Math.round((displayPage / Math.max(1, totalPages)) * 100)
  );

  return (
    <>
      {/* Top Bar */}
      <header
        className={`${styles.topBar} ${!visible ? styles.hidden : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.leftGroup}>
          <Link href="/" className={styles.backBtn} title="Back to Library">
            <ArrowLeft size={18} />
          </Link>
          <div className={styles.titleArea}>
            <span className={styles.bookTitle} title={bookTitle}>
              {bookTitle}
            </span>
            {chapterTitle && (
              <span className={styles.chapterTitle}>{chapterTitle}</span>
            )}
          </div>
        </div>

        <div className={styles.rightGroup}>
          <button
            onClick={onToggleBookmark}
            className={`${styles.actionBtn} ${isBookmarked ? styles.bookmarked : ''}`}
            title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Page'}
            aria-label="Bookmark"
          >
            <BookmarkIcon size={19} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={onOpenBookmarks}
            className={styles.actionBtn}
            title="Saved Bookmarks & Notes"
            aria-label="Bookmarks"
          >
            <BookmarkIcon size={19} />
          </button>
          <button
            onClick={onOpenTOC}
            className={styles.actionBtn}
            title="Table of Contents"
            aria-label="Contents"
          >
            <ListTree size={19} />
          </button>
          <button
            onClick={onOpenSettings}
            className={styles.actionBtn}
            title="Reader Settings"
            aria-label="Settings"
          >
            <SettingsIcon size={19} />
          </button>
        </div>
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
            max={Math.max(1, totalPages)}
            value={sliderVal}
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
            >
              <ChevronLeft size={14} />
              <span>Prev</span>
            </button>
            <button
              onClick={onNextPage}
              disabled={currentPage >= totalPages}
              className={styles.navArrowBtn}
              title="Next Page (Right Arrow)"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Zoom Controls */}
          {onZoomIn && onZoomOut && (
            <div className={styles.zoomControls}>
              <button
                onClick={onZoomOut}
                className={styles.zoomBtn}
                title="Zoom Out (-)"
                aria-label="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={onZoomReset}
                className={styles.zoomLabelBtn}
                title="Click to reset zoom (0)"
              >
                <span>{zoomDisplay || 'Fit'}</span>
              </button>
              <button
                onClick={onZoomIn}
                className={styles.zoomBtn}
                title="Zoom In (+)"
                aria-label="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
            </div>
          )}

          <div>
            <span>
              Page {displayPage} of {totalPages} ({displayPercent}%)
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
