import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Book, ReadingSession } from '@/types';

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

// Cloud Health and Diagnostics
export async function checkCloudHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  tablesReady: boolean;
  storageReady: boolean;
  error?: string;
}> {
  if (!isCloudConfigured()) {
    return {
      configured: false,
      connected: false,
      tablesReady: false,
      storageReady: false,
      error: 'Supabase credentials are not configured in .env.local',
    };
  }

  const sb = getSupabase();
  if (!sb) {
    return {
      configured: true,
      connected: false,
      tablesReady: false,
      storageReady: false,
      error: 'Failed to initialize Supabase client',
    };
  }

  try {
    // 1. Check storage bucket
    const { data: buckets, error: bucketErr } = await sb.storage.listBuckets();
    const hasBucket = Boolean(buckets?.some((b) => b.id === 'user-books' || b.name === 'user-books'));

    // 2. Check books table
    const { error: tableErr } = await sb.from('books').select('id').limit(1);
    const tablesReady = !tableErr || tableErr.code !== 'PGRST205';

    let errorDetail: string | undefined = undefined;
    if (tableErr && tableErr.code === 'PGRST205') {
      errorDetail = 'Table "books" does not exist in Supabase yet. Run the schema SQL to initialize.';
    } else if (bucketErr) {
      errorDetail = bucketErr.message;
    }

    return {
      configured: true,
      connected: true,
      tablesReady,
      storageReady: hasBucket,
      error: errorDetail,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      tablesReady: false,
      storageReady: false,
      error: err?.message || 'Connection failed',
    };
  }
}

// Cloud Upload & Sync Operations with Library Auth Code
export async function uploadBookToCloud(
  book: Book,
  fileData: ArrayBuffer,
  libraryCode: string = 'ERA-DEFAULT'
): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const bucketName = 'user-books';
    const filePath = `${libraryCode}/${book.id}.${book.format}`;

    // Upload binary file to user's library folder in bucket
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

    // Insert metadata tagged with library_code
    const { error: dbError } = await sb.from('books').upsert({
      id: book.id,
      library_code: libraryCode,
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

export async function fetchCloudBooks(libraryCode?: string): Promise<Book[]> {
  const sb = getSupabase();
  if (!sb) return [];

  try {
    let query = sb.from('books').select('*');

    if (libraryCode) {
      // Filter by the user's specific library auth code
      query = query.eq('library_code', libraryCode);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as Book[];
  } catch {
    return [];
  }
}

export async function deleteCloudBook(bookId: string, filePath?: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    if (filePath) {
      await sb.storage.from('user-books').remove([filePath]);
    }
    const { error } = await sb.from('books').delete().eq('id', bookId);
    return !error;
  } catch {
    return false;
  }
}

export async function syncSessionToCloud(
  session: ReadingSession,
  libraryCode?: string
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const payload: Record<string, any> = {
      book_id: session.book_id,
      current_page: session.current_page,
      current_cfi: session.current_cfi,
      progress_percent: session.progress_percent,
      last_read_at: session.last_read_at,
    };

    if (libraryCode) {
      payload.library_code = libraryCode;
    }

    const { error } = await sb.from('reading_sessions').upsert(payload);
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
    // Try primary path (e.g. ERA-XXXX/book-id.pdf)
    let { data, error } = await sb.storage.from('user-books').download(filePath);

    // If failed and path had slashes, attempt downloading flat filename fallback
    if ((error || !data) && filePath.includes('/')) {
      const flatName = filePath.split('/').pop();
      if (flatName) {
        const fallbackRes = await sb.storage.from('user-books').download(flatName);
        data = fallbackRes.data;
        error = fallbackRes.error;
      }
    }

    if (error || !data) return null;
    return await data.arrayBuffer();
  } catch {
    return null;
  }
}
