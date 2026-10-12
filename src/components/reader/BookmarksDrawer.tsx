'use client';

import React from 'react';
import { X, Trash2, Bookmark } from 'lucide-react';
import { BookAnnotation } from '@/types';
import styles from './BookmarksDrawer.module.css';

interface BookmarksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: BookAnnotation[];
  onSelect: (bookmark: BookAnnotation) => void;
  onDelete: (bookmarkId: string) => void;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return dateFormatter.format(date);
}

function rowLabel(bm: BookAnnotation): string {
  return bm.location_page ? `Page ${bm.location_page}` : 'Saved Position';
}

export default function BookmarksDrawer({
  isOpen,
  onClose,
  bookmarks,
  onSelect,
  onDelete,
}: BookmarksDrawerProps) {
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setPendingDeleteId(null);
      return undefined;
    }
    const drawer = drawerRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    drawer?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !drawer) return;
      const focusables = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = drawer.contains(active);
      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sorted = [...bookmarks].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Saved Bookmarks"
        tabIndex={-1}
        className={styles.drawer}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Saved Bookmarks</h2>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.list}>
          {sorted.length > 0 ? (
            sorted.map((bm) => {
              const confirming = pendingDeleteId === bm.id;
              return (
                <div key={bm.id} className={styles.item}>
                  {confirming ? (
                    <div className={styles.confirmArea} role="alertdialog" aria-label="Delete bookmark">
                      <span className={styles.confirmText}>Delete?</span>
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(bm.id);
                          setPendingDeleteId(null);
                        }}
                        className={styles.confirmDeleteBtn}
                        aria-label={bm.location_page ? `Yes, delete page ${bm.location_page}` : 'Yes, delete bookmark'}
                      >
                        Yes, Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        className={styles.confirmCancelBtn}
                        aria-label={bm.location_page ? `Cancel deleting page ${bm.location_page}` : 'Cancel deleting bookmark'}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(bm);
                          onClose();
                        }}
                        className={styles.itemClickable}
                      >
                        <span className={styles.itemPage}>{rowLabel(bm)}</span>
                        <span className={styles.itemDate}>{formatDate(bm.created_at)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(bm.id)}
                        className={styles.deleteBtn}
                        aria-label={
                          bm.location_page
                            ? `Delete bookmark page ${bm.location_page}`
                            : 'Delete bookmark'
                        }
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              );
            })
          ) : (
            <div className={styles.empty}>
              <Bookmark size={28} aria-hidden="true" className={styles.emptyIcon} />
              <p>No bookmarks yet — tap the bookmark icon while reading to save your place.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
