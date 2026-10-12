import * as pdfjsLib from 'pdfjs-dist';
import ePub from 'epubjs';
import { BookFormat } from '@/types';

// Ensure PDF.js worker is registered
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export interface ParsedBookMetadata {
  title: string;
  author: string;
  format: BookFormat;
  totalPages: number;
  coverDataUrl?: string;
}

export async function parseBookFile(file: File): Promise<ParsedBookMetadata> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const format: BookFormat = extension === 'epub' ? 'epub' : 'pdf';
  const arrayBuffer = await file.arrayBuffer();

  if (format === 'pdf') {
    return parsePDF(arrayBuffer, file.name);
  } else {
    return parseEPUB(arrayBuffer, file.name);
  }
}

async function parsePDF(data: ArrayBuffer, fileName: string): Promise<ParsedBookMetadata> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    let title = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    let author = 'Unknown Author';

    try {
      const meta = await pdfDoc.getMetadata();
      const info = meta?.info as any;
      if (info?.Title && typeof info.Title === 'string' && info.Title.trim().length > 1) {
        title = info.Title.trim();
      }
      if (info?.Author && typeof info.Author === 'string' && info.Author.trim().length > 1) {
        author = info.Author.trim();
      }
    } catch {
      // fallback to filename
    }

    // Generate cover thumbnail from Page 1
    let coverDataUrl: string | undefined;
    try {
      const page = await pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 1.0 });
      const targetWidth = 320;
      const scale = targetWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        const renderTask = page.render({
          canvas,
          canvasContext: ctx,
          viewport: scaledViewport,
        });
        await renderTask.promise;
        coverDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }
    } catch (coverErr) {
      console.warn('Failed to render PDF cover thumbnail:', coverErr);
    }

    return {
      title,
      author,
      format: 'pdf',
      totalPages,
      coverDataUrl,
    };
  } catch (err) {
    console.error('Error parsing PDF:', err);
    return {
      title: fileName.replace(/\.[^/.]+$/, ''),
      author: 'Unknown Author',
      format: 'pdf',
      totalPages: 1,
    };
  }
}

async function parseEPUB(data: ArrayBuffer, fileName: string): Promise<ParsedBookMetadata> {
  try {
    const book = ePub(data);
    await book.ready;

    const meta = (book as any).package?.metadata || {};
    let title = meta.title || fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    let author = meta.creator || 'Unknown Author';

    // Try extracting cover
    let coverDataUrl: string | undefined;
    try {
      const coverUrl = await book.coverUrl();
      if (coverUrl) {
        coverDataUrl = coverUrl;
      }
    } catch {
      // Cover extraction is optional
    }

    const spine = (book as any).spine;
    const totalPages = spine?.length || 50;

    return {
      title,
      author,
      format: 'epub',
      totalPages,
      coverDataUrl,
    };
  } catch (err) {
    console.error('Error parsing EPUB:', err);
    return {
      title: fileName.replace(/\.[^/.]+$/, ''),
      author: 'Unknown Author',
      format: 'epub',
      totalPages: 1,
    };
  }
}
