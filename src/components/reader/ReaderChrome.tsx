'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ListTree,
  Bookmark as BookmarkIcon,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
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
  onToggleBookmark,
  onOpenTOC,
  onOpenBookmarks,
  onOpenSettings,
  onPageChange,
  onPrevPage,
  onNextPage,
}: ReaderChromeProps) {
  return (
    <>
      {/* Top Bar */}
      <header className={`${styles.topBar} ${!visible ? styles.hidden : ''}`}>
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
      <footer className={`${styles.bottomBar} ${!visible ? styles.hidden : ''}`}>
        <div className={styles.scrubberRow}>
          <input
            type="range"
            min={1}
            max={Math.max(1, totalPages)}
            value={currentPage}
            onChange={(e) => onPageChange(Number(e.target.value))}
            className={styles.pageSlider}
          />
        </div>

        <div className={styles.bottomInfoRow}>
          <div className={styles.pageControls}>
            <button
              onClick={onPrevPage}
              disabled={currentPage <= 1}
              className={styles.navArrowBtn}
            >
              <ChevronLeft size={14} />
              <span>Prev</span>
            </button>
            <button
              onClick={onNextPage}
              disabled={currentPage >= totalPages}
              className={styles.navArrowBtn}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div>
            <span>Page {currentPage} of {totalPages} ({percent}%)</span>
          </div>
        </div>
      </footer>
    </>
  );
}
