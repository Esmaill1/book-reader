'use client';

import React from 'react';
import Link from 'next/link';
import { Book, ReadingSession } from '@/types';
import { BookOpen, Trash2 } from 'lucide-react';
import styles from './BookCard.module.css';

interface BookCardProps {
  book: Book;
  session?: ReadingSession;
  onDelete?: (e: React.MouseEvent, bookId: string) => void;
}

export default function BookCard({ book, session, onDelete }: BookCardProps) {
  const percent = session ? Math.round(session.progress_percent) : 0;
  const currentPage = session?.current_page || 1;
  const totalPages = book.total_pages || 1;

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete && confirm(`Are you sure you want to remove "${book.title}" from your library?`)) {
      onDelete(e, book.id);
    }
  };

  return (
    <Link href={`/read/${book.id}`} className={styles.card}>
      {onDelete && (
        <button
          onClick={handleDelete}
          className={styles.deleteBtn}
          title="Delete book from library"
          aria-label="Delete book"
        >
          <Trash2 size={14} />
        </button>
      )}

      <div className={styles.coverContainer}>
        <span className={styles.formatBadge}>{book.format}</span>
        {book.cover_data_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={book.cover_data_url} alt={book.title} className={styles.coverImage} />
        ) : (
          <div className={styles.fallbackCover}>
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
    </Link>
  );
}
