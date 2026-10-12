'use client';

import React from 'react';
import Link from 'next/link';
import { Book, ReadingSession } from '@/types';
import { BookOpen, ChevronRight } from 'lucide-react';
import styles from './ReadingNow.module.css';

interface ReadingNowProps {
  book: Book;
  session?: ReadingSession;
}

export default function ReadingNow({ book, session }: ReadingNowProps) {
  const percent = session ? Math.round(session.progress_percent) : 0;
  const currentPage = session?.current_page || 1;
  const totalPages = book.total_pages || 1;

  return (
    <div className={styles.heroCard}>
      <div className={styles.coverWrapper}>
        {book.cover_data_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={book.cover_data_url} alt={book.title} className={styles.coverImg} />
        ) : (
          <div className={styles.coverFallback}>
            <BookOpen size={36} />
          </div>
        )}
      </div>

      <div className={styles.details}>
        <div className={styles.topInfo}>
          <div className={styles.badgeRow}>
            <span className={styles.readingBadge}>Reading Now</span>
            <span className={styles.formatBadge}>{book.format}</span>
          </div>
          <h2 className={styles.title}>{book.title}</h2>
          <p className={styles.author}>{book.author}</p>
        </div>

        <div className={styles.progressSection}>
          <div className={styles.progressLabels}>
            <span>Page {currentPage} of {totalPages}</span>
            <span>{percent}%</span>
          </div>
          <div className={styles.progressBarTrack}>
            <div className={styles.progressBarFill} style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className={styles.bottomAction}>
          <Link href={`/read/${book.id}`} className={styles.continueBtn}>
            <span>Continue Reading</span>
            <ChevronRight size={18} />
          </Link>
          {session?.last_read_at && (
            <span className={styles.lastReadText}>
              Last read {new Date(session.last_read_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
