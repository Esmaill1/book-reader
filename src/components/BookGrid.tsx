'use client';

import React, { useState, useMemo } from 'react';
import { Book, ReadingSession, BookFormat } from '@/types';
import BookCard from './BookCard';
import { Search, BookPlus, Library } from 'lucide-react';
import styles from './BookGrid.module.css';

interface BookGridProps {
  books: Book[];
  sessions: Record<string, ReadingSession>;
  onDeleteBook: (e: React.MouseEvent, bookId: string) => void;
  onOpenUpload: () => void;
}

export default function BookGrid({
  books,
  sessions,
  onDeleteBook,
  onOpenUpload,
}: BookGridProps) {
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | BookFormat>('all');

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const matchesSearch =
        book.title.toLowerCase().includes(search.toLowerCase()) ||
        book.author.toLowerCase().includes(search.toLowerCase());

      const matchesFormat = formatFilter === 'all' || book.format === formatFilter;

      return matchesSearch && matchesFormat;
    });
  }, [books, search, formatFilter]);

  return (
    <div className={styles.container}>
      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search books by title or author..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.formatTabs}>
          <button
            onClick={() => setFormatFilter('all')}
            className={`${styles.tabBtn} ${formatFilter === 'all' ? styles.active : ''}`}
          >
            All ({books.length})
          </button>
          <button
            onClick={() => setFormatFilter('pdf')}
            className={`${styles.tabBtn} ${formatFilter === 'pdf' ? styles.active : ''}`}
          >
            PDF ({books.filter((b) => b.format === 'pdf').length})
          </button>
          <button
            onClick={() => setFormatFilter('epub')}
            className={`${styles.tabBtn} ${formatFilter === 'epub' ? styles.active : ''}`}
          >
            EPUB ({books.filter((b) => b.format === 'epub').length})
          </button>
        </div>
      </div>

      {filteredBooks.length > 0 ? (
        <div className={styles.grid}>
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              session={sessions[book.id]}
              onDelete={onDeleteBook}
            />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <Library className={styles.emptyIcon} />
          <h3 className={styles.emptyTitle}>
            {search ? 'No matching books found' : 'Your library is empty'}
          </h3>
          <p className={styles.emptyDesc}>
            {search
              ? 'Try searching with different keywords or clearing your filters.'
              : 'Upload PDF or EPUB books to start reading and syncing your progress across your devices.'}
          </p>
          {!search && (
            <button onClick={onOpenUpload} className={styles.uploadEmptyBtn}>
              <BookPlus size={18} />
              <span>Upload Book</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
