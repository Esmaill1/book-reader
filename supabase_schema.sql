-- ========================================================
-- BookEra Web — Multi-Device Library Schema & Storage
-- Project: xkezqqhritdkuygiqafr
-- Run this in Supabase Dashboard -> SQL Editor -> New Query
-- ========================================================

-- 1. Create Books Table with library_code
CREATE TABLE IF NOT EXISTS public.books (
    id TEXT PRIMARY KEY,
    library_code TEXT NOT NULL DEFAULT 'ERA-DEFAULT',
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

-- Index for fast library querying by user's auth code
CREATE INDEX IF NOT EXISTS idx_books_library_code ON public.books(library_code);

-- 2. Create Reading Sessions Table (Synced Reading Progress)
CREATE TABLE IF NOT EXISTS public.reading_sessions (
    book_id TEXT PRIMARY KEY REFERENCES public.books(id) ON DELETE CASCADE,
    library_code TEXT,
    current_page INTEGER DEFAULT 1,
    current_cfi TEXT,
    progress_percent INTEGER DEFAULT 0,
    last_read_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_library_code ON public.reading_sessions(library_code);

-- 3. Create Book Annotations Table
CREATE TABLE IF NOT EXISTS public.book_annotations (
    id TEXT PRIMARY KEY,
    book_id TEXT REFERENCES public.books(id) ON DELETE CASCADE,
    library_code TEXT,
    type TEXT NOT NULL,
    location_page INTEGER,
    location_cfi TEXT,
    selected_text TEXT,
    note_content TEXT,
    color TEXT DEFAULT 'yellow',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_annotations_library_code ON public.book_annotations(library_code);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_annotations ENABLE ROW LEVEL SECURITY;

-- 5. Open Policies for Auth-Code Based Multi-Device Access
DROP POLICY IF EXISTS "Public Read Books" ON public.books;
DROP POLICY IF EXISTS "Public Insert Books" ON public.books;
DROP POLICY IF EXISTS "Public Update Books" ON public.books;
DROP POLICY IF EXISTS "Public Delete Books" ON public.books;

CREATE POLICY "Public Read Books" ON public.books FOR SELECT USING (true);
CREATE POLICY "Public Insert Books" ON public.books FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Books" ON public.books FOR UPDATE USING (true);
CREATE POLICY "Public Delete Books" ON public.books FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public Read Sessions" ON public.reading_sessions;
DROP POLICY IF EXISTS "Public Insert Sessions" ON public.reading_sessions;
DROP POLICY IF EXISTS "Public Update Sessions" ON public.reading_sessions;

CREATE POLICY "Public Read Sessions" ON public.reading_sessions FOR SELECT USING (true);
CREATE POLICY "Public Insert Sessions" ON public.reading_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Sessions" ON public.reading_sessions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public Annotations All" ON public.book_annotations;
CREATE POLICY "Public Annotations All" ON public.book_annotations FOR ALL USING (true) WITH CHECK (true);

-- 6. Storage Bucket for Book Files ('user-books')
INSERT INTO storage.buckets (id, name, public) 
VALUES ('user-books', 'user-books', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- 7. Storage Policies for 'user-books' Bucket
DROP POLICY IF EXISTS "Public Storage Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Storage Select" ON storage.objects;
DROP POLICY IF EXISTS "Public Storage Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Storage Delete" ON storage.objects;

CREATE POLICY "Public Storage Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'user-books');
CREATE POLICY "Public Storage Select" ON storage.objects FOR SELECT USING (bucket_id = 'user-books');
CREATE POLICY "Public Storage Update" ON storage.objects FOR UPDATE USING (bucket_id = 'user-books');
CREATE POLICY "Public Storage Delete" ON storage.objects FOR DELETE USING (bucket_id = 'user-books');
