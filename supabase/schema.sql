-- ========================================================
-- BookEra Web: Supabase Schema & Storage Configuration
-- ========================================================

-- 1. Create Books Table
CREATE TABLE IF NOT EXISTS public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    author TEXT DEFAULT 'Unknown Author',
    format TEXT NOT NULL CHECK (format IN ('pdf', 'epub')),
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    cover_data_url TEXT,
    total_pages INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Reading Sessions Table
CREATE TABLE IF NOT EXISTS public.reading_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE UNIQUE,
    current_page INTEGER DEFAULT 1,
    current_cfi TEXT,
    progress_percent REAL DEFAULT 0.0,
    last_read_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Annotations & Bookmarks Table
CREATE TABLE IF NOT EXISTS public.book_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('bookmark', 'highlight', 'note')),
    location_page INTEGER,
    location_cfi TEXT,
    selected_text TEXT,
    note_content TEXT,
    color TEXT DEFAULT 'yellow',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS) or Open Policy for Personal DB
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_annotations ENABLE ROW LEVEL SECURITY;

-- Allow read/write for personal authenticated/anon users
CREATE POLICY "Allow all operations on books" ON public.books FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on sessions" ON public.reading_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on annotations" ON public.book_annotations FOR ALL USING (true) WITH CHECK (true);

-- 5. Storage Bucket:
-- In Supabase Dashboard -> Storage -> Create a new bucket named: "user-books"
-- Toggle "Public bucket" ON (or create policy for authenticated upload/read).
