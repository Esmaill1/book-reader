'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Header from '@/components/Header';
import ReadingNow from '@/components/ReadingNow';
import BookGrid from '@/components/BookGrid';
import UploadModal from '@/components/UploadModal';
import { Book, ReadingSession } from '@/types';
import { getAllLocalBooks, getAllLocalSessions, deleteLocalBook } from '@/lib/db';
import { fetchCloudBooks, isCloudConfigured } from '@/lib/supabase';
import styles from './page.module.css';

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [sessions, setSessions] = useState<Record<string, ReadingSession>>({});
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load books and reading sessions
  const loadLibrary = async () => {
    try {
      setLoading(true);
      const [localBooks, localSessions] = await Promise.all([
        getAllLocalBooks(),
        getAllLocalSessions(),
      ]);

      let combinedBooks = [...localBooks];

      // If cloud is enabled, merge cloud books
      if (isCloudConfigured()) {
        try {
          const cloudBooks = await fetchCloudBooks();
          const existingIds = new Set(localBooks.map((b) => b.id));
          cloudBooks.forEach((cb) => {
            if (!existingIds.has(cb.id)) {
              combinedBooks.push(cb);
            }
          });
        } catch (cloudErr) {
          console.warn('Could not fetch cloud books:', cloudErr);
        }
      }

      setBooks(combinedBooks);

      const sessionMap: Record<string, ReadingSession> = {};
      localSessions.forEach((s) => {
        sessionMap[s.book_id] = s;
      });
      setSessions(sessionMap);
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  const activeBook = useMemo(() => {
    if (books.length === 0) return null;

    // Find the book with the latest last_read_at
    let mostRecent: { book: Book; session?: ReadingSession } | null = null;
    let latestTime = 0;

    for (const book of books) {
      const s = sessions[book.id];
      if (s?.last_read_at) {
        const t = new Date(s.last_read_at).getTime();
        if (t > latestTime) {
          latestTime = t;
          mostRecent = { book, session: s };
        }
      }
    }

    if (mostRecent) return mostRecent;

    // Fallback: first book in library
    return { book: books[0], session: sessions[books[0].id] };
  }, [books, sessions]);

  const handleDeleteBook = async (e: React.MouseEvent, bookId: string) => {
    try {
      await deleteLocalBook(bookId);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      setSessions((prev) => {
        const next = { ...prev };
        delete next[bookId];
        return next;
      });
    } catch (err) {
      console.error('Failed to delete book:', err);
    }
  };

  const handleBookAdded = (newBook: Book) => {
    setBooks((prev) => [newBook, ...prev]);
  };

  return (
    <main className={styles.main}>
      <Header onOpenUpload={() => setIsUploadOpen(true)} />

      <div className={styles.contentWrapper}>
        {activeBook && !loading && (
          <ReadingNow book={activeBook.book} session={activeBook.session} />
        )}

        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>All Books</h2>
        </div>

        <BookGrid
          books={books}
          sessions={sessions}
          onDeleteBook={handleDeleteBook}
          onOpenUpload={() => setIsUploadOpen(true)}
        />
      </div>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onBookAdded={handleBookAdded}
      />
    </main>
  );
}
