import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Book, ReadingSession, BookAnnotation } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

export function isCloudConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

// Cloud Upload & Sync Operations
export async function uploadBookToCloud(book: Book, fileData: ArrayBuffer): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const bucketName = 'user-books';
    const filePath = `${book.id}.${book.format}`;

    // Upload binary file
    const { error: uploadError } = await sb.storage
      .from(bucketName)
      .upload(filePath, fileData, {
        contentType: book.format === 'pdf' ? 'application/pdf' : 'application/epub+zip',
        upsert: true,
      });

    if (uploadError) {
      console.warn('Supabase storage upload error:', uploadError);
      return null;
    }

    // Insert metadata into database
    const { error: dbError } = await sb.from('books').upsert({
      id: book.id,
      title: book.title,
      author: book.author,
      format: book.format,
      file_path: filePath,
      file_size: book.file_size,
      cover_data_url: book.cover_data_url,
      total_pages: book.total_pages,
      created_at: book.created_at,
      updated_at: book.updated_at,
    });

    if (dbError) {
      console.warn('Supabase DB book insert error:', dbError);
    }

    return filePath;
  } catch (err) {
    console.warn('Failed cloud upload:', err);
    return null;
  }
}

export async function fetchCloudBooks(): Promise<Book[]> {
  const sb = getSupabase();
  if (!sb) return [];

  try {
    const { data, error } = await sb
      .from('books')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as Book[];
  } catch {
    return [];
  }
}

export async function syncSessionToCloud(session: ReadingSession): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { error } = await sb.from('reading_sessions').upsert({
      book_id: session.book_id,
      current_page: session.current_page,
      current_cfi: session.current_cfi,
      progress_percent: session.progress_percent,
      last_read_at: session.last_read_at,
    });

    return !error;
  } catch {
    return false;
  }
}

export async function fetchCloudSession(bookId: string): Promise<ReadingSession | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('reading_sessions')
      .select('*')
      .eq('book_id', bookId)
      .single();

    if (error || !data) return null;
    return data as ReadingSession;
  } catch {
    return null;
  }
}

export async function downloadCloudBookFile(filePath: string): Promise<ArrayBuffer | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb.storage.from('user-books').download(filePath);
    if (error || !data) return null;
    return await data.arrayBuffer();
  } catch {
    return null;
  }
}
