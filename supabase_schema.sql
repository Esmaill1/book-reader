-- ========================================================
-- BookEra Web — Supabase Schema & Storage Policies
-- Project: xkezqqhritdkuygiqafr
-- Run this in Supabase Dashboard -> SQL Editor -> New Query
-- ========================================================

-- 1. Books Table
CREATE TABLE IF NOT EXISTS public.books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    format TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    cover_data_url TEXT,
    total_pages INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Reading Sessions Table (Synced Reading Progress)
CREATE TABLE IF NOT EXISTS public.reading_sessions (
    book_id TEXT PRIMARY KEY REFERENCES public.books(id) ON DELETE CASCADE,
    current_page INTEGER DEFAULT 1,
    current_cfi TEXT,
    progress_percent INTEGER DEFAULT 0,
    last_read_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Access Policies for Books
DROP POLICY IF EXISTS "Public Read Books" ON public.books;
DROP POLICY IF EXISTS "Public Insert Books" ON public.books;
DROP POLICY IF EXISTS "Public Update Books" ON public.books;
DROP POLICY IF EXISTS "Public Delete Books" ON public.books;

CREATE POLICY "Public Read Books" ON public.books FOR SELECT USING (true);
CREATE POLICY "Public Insert Books" ON public.books FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Books" ON public.books FOR UPDATE USING (true);
CREATE POLICY "Public Delete Books" ON public.books FOR DELETE USING (true);

-- 5. Access Policies for Reading Sessions
DROP POLICY IF EXISTS "Public Read Sessions" ON public.reading_sessions;
DROP POLICY IF EXISTS "Public Insert Sessions" ON public.reading_sessions;
DROP POLICY IF EXISTS "Public Update Sessions" ON public.reading_sessions;

CREATE POLICY "Public Read Sessions" ON public.reading_sessions FOR SELECT USING (true);
CREATE POLICY "Public Insert Sessions" ON public.reading_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Sessions" ON public.reading_sessions FOR UPDATE USING (true);

-- 6. Storage Policies for 'user-books' Bucket
DROP POLICY IF EXISTS "Public Storage Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Storage Select" ON storage.objects;
DROP POLICY IF EXISTS "Public Storage Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Storage Delete" ON storage.objects;

CREATE POLICY "Public Storage Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'user-books');
CREATE POLICY "Public Storage Select" ON storage.objects FOR SELECT USING (bucket_id = 'user-books');
CREATE POLICY "Public Storage Update" ON storage.objects FOR UPDATE USING (bucket_id = 'user-books');
CREATE POLICY "Public Storage Delete" ON storage.objects FOR DELETE USING (bucket_id = 'user-books');
