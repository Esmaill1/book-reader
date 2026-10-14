import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Book, ReadingSession, BookAnnotation } from '@/types';

interface BookEraDB extends DBSchema {
  books: {
    key: string;
    value: Book;
  };
  book_files: {
    key: string;
    value: {
      book_id: string;
      data: ArrayBuffer;
      type: string;
    };
  };
  reading_sessions: {
    key: string; // book_id
    value: ReadingSession;
  };
  annotations: {
    key: string; // annotation id
    value: BookAnnotation;
    indexes: { 'by-book': string };
  };
  sync_queue: {
    key: number;
    value: {
      action: 'session_update' | 'annotation_add' | 'annotation_delete';
      payload: any;
      timestamp: number;
    };
    autoIncrement: true;
  };
}

const DB_NAME = 'bookera_local_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BookEraDB>> | null = null;

export function getLocalDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<BookEraDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('book_files')) {
          db.createObjectStore('book_files', { keyPath: 'book_id' });
        }
        if (!db.objectStoreNames.contains('reading_sessions')) {
          db.createObjectStore('reading_sessions', { keyPath: 'book_id' });
        }
        if (!db.objectStoreNames.contains('annotations')) {
          const annotStore = db.createObjectStore('annotations', { keyPath: 'id' });
          annotStore.createIndex('by-book', 'book_id');
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

// Local Book operations
export async function saveLocalBook(book: Book, fileData: ArrayBuffer, mimeType: string): Promise<void> {
  const db = await getLocalDB();
  if (!db) return;
  const tx = db.transaction(['books', 'book_files'], 'readwrite');
  await tx.objectStore('books').put(book);
  await tx.objectStore('book_files').put({
    book_id: book.id,
    data: fileData,
    type: mimeType,
  });
  await tx.done;
}

export async function getAllLocalBooks(libraryCode?: string): Promise<Book[]> {
  const db = await getLocalDB();
  if (!db) return [];
  const all = await db.getAll('books');
  if (!libraryCode) return all;
  return all.filter((b) => !b.library_code || b.library_code === libraryCode);
}

export async function getLocalBook(id: string): Promise<Book | undefined> {
  const db = await getLocalDB();
  if (!db) return undefined;
  return db.get('books', id);
}

export async function getLocalBookFile(bookId: string): Promise<{ data: ArrayBuffer; type: string } | undefined> {
  const db = await getLocalDB();
  if (!db) return undefined;
  return db.get('book_files', bookId);
}

export async function deleteLocalBook(bookId: string): Promise<void> {
  const db = await getLocalDB();
  if (!db) return;
  const tx = db.transaction(['books', 'book_files', 'reading_sessions', 'annotations'], 'readwrite');
  await tx.objectStore('books').delete(bookId);
  await tx.objectStore('book_files').delete(bookId);
  await tx.objectStore('reading_sessions').delete(bookId);
  await tx.done;
}

// Local Session operations
export async function saveLocalSession(session: ReadingSession): Promise<void> {
  const db = await getLocalDB();
  if (!db) return;
  await db.put('reading_sessions', session);
}

export async function getLocalSession(bookId: string): Promise<ReadingSession | undefined> {
  const db = await getLocalDB();
  if (!db) return undefined;
  return db.get('reading_sessions', bookId);
}

export async function getAllLocalSessions(): Promise<ReadingSession[]> {
  const db = await getLocalDB();
  if (!db) return [];
  return db.getAll('reading_sessions');
}

// Local Annotations operations
export async function saveLocalAnnotation(annotation: BookAnnotation): Promise<void> {
  const db = await getLocalDB();
  if (!db) return;
  await db.put('annotations', annotation);
}

export async function getLocalAnnotationsForBook(bookId: string): Promise<BookAnnotation[]> {
  const db = await getLocalDB();
  if (!db) return [];
  return db.getAllFromIndex('annotations', 'by-book', bookId);
}

export async function deleteLocalAnnotation(annotationId: string): Promise<void> {
  const db = await getLocalDB();
  if (!db) return;
  await db.delete('annotations', annotationId);
}
