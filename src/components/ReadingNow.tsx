'use client';

import React from 'react';
import Link from 'next/link';
import { Book, ReadingSession } from '@/types';
import { BookOpen, ChevronRight, Clock } from 'lucide-react';
import styles from './ReadingNow.module.css';

interface ReadingNowProps {
  book: Book;
  session?: ReadingSession;
}

export default function ReadingNow({ book, session }: ReadingNowProps) {
  const percent = session ? Math.round(session.progress_percent) : 0;
  const currentPage = session?.current_page || 1;
  const totalPages = book.total_pages || 1;
  const progressLabel = `Page ${currentPage} of ${totalPages} — ${percent}% complete`;

  return (
    <section className={styles.heroCard} aria-label="Currently reading">
      <div className={styles.coverWrapper} aria-hidden="true">
        {book.cover_data_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={book.cover_data_url} alt="" className={styles.coverImg} />
        ) : (
          <div className={styles.coverFallback}>
            <BookOpen size={40} />
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
            <span className={styles.progressPercent}>{percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-label={`Reading progress for ${book.title}`}
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={progressLabel}
            className={styles.progressBarTrack}
          >
            <div className={styles.progressBarFill} style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className={styles.bottomAction}>
          <Link href={`/read/${book.id}`} className={styles.continueBtn}>
            <span>Continue Reading</span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
          {session?.last_read_at && (
            <span className={styles.lastReadText}>
              <Clock size={14} className={styles.lastReadIcon} aria-hidden="true" />
              Last read {new Date(session.last_read_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
