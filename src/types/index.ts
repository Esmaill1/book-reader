export type BookFormat = 'pdf' | 'epub';

export type ReadingTheme = 'day' | 'sepia' | 'night' | 'oled';

export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  file_path: string;
  file_size: number;
  cover_data_url?: string;
  total_pages: number;
  created_at: string;
  updated_at: string;
}

export interface ReadingSession {
  id: string;
  book_id: string;
  current_page: number;
  current_cfi?: string;
  progress_percent: number;
  last_read_at: string;
}

export interface BookAnnotation {
  id: string;
  book_id: string;
  type: 'bookmark' | 'highlight' | 'note';
  location_page?: number;
  location_cfi?: string;
  selected_text?: string;
  note_content?: string;
  color?: string;
  created_at: string;
}

export interface TypographySettings {
  fontSize: number;       // in px, e.g. 18
  lineHeight: number;     // unitless multiplier, e.g. 1.6
  fontFamily: 'sans' | 'serif' | 'cairo' | 'amiri';
  margin: 'narrow' | 'normal' | 'wide';
  alignment: 'justify' | 'left' | 'right';
}

export interface PDFViewSettings {
  scrollMode: 'continuous' | 'single';
  zoomMode: 'fit-width' | 'fit-page' | 'custom';
  customZoom: number;     // e.g. 1.0, 1.25, 1.5
}

export interface ReaderSettings {
  theme: ReadingTheme;
  typography: TypographySettings;
  pdfView: PDFViewSettings;
}
