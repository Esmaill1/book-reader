'use client';

import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { BookAnnotation } from '@/types';
import styles from './BookmarksDrawer.module.css';

interface BookmarksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: BookAnnotation[];
  onSelect: (bookmark: BookAnnotation) => void;
  onDelete: (bookmarkId: string) => void;
}

export default function BookmarksDrawer({
  isOpen,
  onClose,
  bookmarks,
  onSelect,
  onDelete,
}: BookmarksDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Saved Bookmarks</h2>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Close bookmarks">
            <X size={20} />
          </button>
        </div>

        <div className={styles.list}>
          {bookmarks.length > 0 ? (
            bookmarks.map((bm) => (
              <div key={bm.id} className={styles.item}>
                <button
                  onClick={() => {
                    onSelect(bm);
                    onClose();
                  }}
                  className={styles.itemClickable}
                >
                  <span className={styles.itemPage}>
                    {bm.location_page ? `Page ${bm.location_page}` : 'Saved Position'}
                  </span>
                  <span className={styles.itemDate}>
                    {new Date(bm.created_at).toLocaleDateString()}
                  </span>
                </button>
                <button
                  onClick={() => onDelete(bm.id)}
                  className={styles.deleteBtn}
                  title="Delete bookmark"
                  aria-label="Delete bookmark"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          ) : (
            <div className={styles.empty}>
              No bookmarks saved yet. Tap the bookmark icon on any page to save your place!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
