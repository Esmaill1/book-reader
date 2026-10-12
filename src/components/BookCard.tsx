'use client';

import React, { useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import { Book, ReadingSession } from '@/types';
import { BookOpen, Trash2, AlertTriangle } from 'lucide-react';
import styles from './BookCard.module.css';
import dialogStyles from './UploadModal.module.css';

interface BookCardProps {
  book: Book;
  session?: ReadingSession;
  onDelete?: (bookId: string) => void;
}

/* ---------- Confirm dialog (rendered by the card) ---------- */

interface ConfirmDialogProps {
  bookTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ bookTitle, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const lastFocused = useRef<HTMLElement | null>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    lastFocused.current = document.activeElement as HTMLElement | null;

    const dialogEl = dialogRef.current;
    const focusTarget =
      dialogEl?.querySelector<HTMLElement>(`[data-autofocus]`) ?? null;
    focusTarget?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cancelRef.current();
        return;
      }
      if (e.key === 'Tab' && dialogEl) {
        const focusables = Array.from(
          dialogEl.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!dialogEl.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      lastFocused.current?.focus();
    };
  }, []);

  return (
    <div className={dialogStyles.backdrop} onClick={onCancel}>
      <div
        className={dialogStyles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.confirmHeader}>
          <span className={styles.confirmIconWrap}>
            <AlertTriangle className={styles.confirmIcon} aria-hidden="true" />
          </span>
          <h2 id={titleId} className={styles.confirmTitle}>
            Delete Book
          </h2>
          <p id={descId} className={styles.confirmDesc}>
            “{bookTitle}” will be removed from your library. Reading progress for
            this book will also be lost. This can’t be undone.
          </p>
        </div>
        <div className={styles.confirmActions}>
          <button
            type="button"
            onClick={onCancel}
            className={styles.confirmCancelBtn}
            data-autofocus=""
          >
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className={styles.confirmDeleteBtn}>
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Book card ---------- */

export default function BookCard({ book, session, onDelete }: BookCardProps) {
  const percent = session ? Math.round(session.progress_percent) : 0;
  const currentPage = session?.current_page || 1;
  const totalPages = book.total_pages || 1;
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <article className={styles.card}>
      <div className={styles.coverContainer}>
        <span className={styles.formatBadge}>{book.format}</span>
        {book.cover_data_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={book.cover_data_url} alt="" className={styles.coverImage} />
        ) : (
          <div className={styles.fallbackCover} aria-hidden="true">
            <BookOpen size={28} />
            <p className={styles.fallbackTitle}>{book.title}</p>
          </div>
        )}
      </div>

      <div className={styles.cardContent}>
        <h3 className={styles.title} title={book.title}>{book.title}</h3>
        <p className={styles.author}>{book.author}</p>

        <div className={styles.progressWrap}>
          <div className={styles.progressText}>
            <span>p. {currentPage}/{totalPages}</span>
            <span>{percent}%</span>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      {/* Whole-card link covers cover + content */}
      <Link href={`/read/${book.id}`} className={styles.cardLink} aria-label={`Read ${book.title}`}>
        <span className={styles.visuallyHidden}>{book.title} by {book.author}</span>
      </Link>

      {onDelete && (
        <button
          onClick={() => setConfirmOpen(true)}
          className={styles.deleteBtn}
          title="Delete book from library"
          aria-label={`Delete ${book.title}`}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      )}

      {confirmOpen && onDelete && (
        <ConfirmDialog
          bookTitle={book.title}
          onConfirm={() => {
            setConfirmOpen(false);
            onDelete(book.id);
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </article>
  );
}
