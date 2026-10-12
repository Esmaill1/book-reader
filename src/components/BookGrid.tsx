'use client';

import React, { useState, useMemo } from 'react';
import { Book, ReadingSession, BookFormat } from '@/types';
import BookCard from './BookCard';
import { Search, BookPlus, LibraryBig, SearchX, X } from 'lucide-react';
import styles from './BookGrid.module.css';

interface BookGridProps {
  books: Book[];
  sessions: Record<string, ReadingSession>;
  onDeleteBook: (bookId: string) => void;
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

  const isFiltering = search.trim() !== '' || formatFilter !== 'all';

  return (
    <div className={styles.container}>
      <div className={styles.filterBar} role="search">
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="text"
            placeholder="Search by title or author…"
            aria-label="Search books by title or author"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className={styles.clearSearchBtn}
              aria-label="Clear search"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className={styles.formatTabs} role="group" aria-label="Filter by format">
          <button
            onClick={() => setFormatFilter('all')}
            className={`${styles.tabBtn} ${formatFilter === 'all' ? styles.active : ''}`}
            aria-pressed={formatFilter === 'all'}
          >
            All ({books.length})
          </button>
          <button
            onClick={() => setFormatFilter('pdf')}
            className={`${styles.tabBtn} ${formatFilter === 'pdf' ? styles.active : ''}`}
            aria-pressed={formatFilter === 'pdf'}
          >
            PDF ({books.filter((b) => b.format === 'pdf').length})
          </button>
          <button
            onClick={() => setFormatFilter('epub')}
            className={`${styles.tabBtn} ${formatFilter === 'epub' ? styles.active : ''}`}
            aria-pressed={formatFilter === 'epub'}
          >
            EPUB ({books.filter((b) => b.format === 'epub').length})
          </button>
        </div>
      </div>

      {filteredBooks.length > 0 ? (
        <ul className={styles.grid} aria-label="All books">
          {filteredBooks.map((book) => (
            <li key={book.id} className={styles.gridItem}>
              <BookCard
                book={book}
                session={sessions[book.id]}
                onDelete={onDeleteBook}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconWrap}>
            {isFiltering ? (
              <SearchX className={styles.emptyIcon} aria-hidden="true" />
            ) : (
              <LibraryBig className={styles.emptyIcon} aria-hidden="true" />
            )}
          </div>
          <h3 className={styles.emptyTitle}>
            {isFiltering ? 'No books match your search' : 'Your shelf is empty'}
          </h3>
          <p className={styles.emptyDesc}>
            {isFiltering
              ? 'Try a different keyword, or clear the search to browse your whole library.'
              : 'Add a PDF or EPUB to start reading, and your progress will sync across your devices.'}
          </p>
          {isFiltering ? (
            <button
              onClick={() => {
                setSearch('');
                setFormatFilter('all');
              }}
              className={styles.emptyGhostBtn}
            >
              <X size={18} aria-hidden="true" />
              <span>Clear Filters</span>
            </button>
          ) : (
            <button onClick={onOpenUpload} className={styles.emptyPrimaryBtn}>
              <BookPlus size={18} aria-hidden="true" />
              <span>Add your first book</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
