'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, UploadCloud, Loader2, AlertCircle } from 'lucide-react';
import { parseBookFile } from '@/lib/parser';
import { saveLocalBook } from '@/lib/db';
import { uploadBookToCloud, isCloudConfigured } from '@/lib/supabase';
import { Book } from '@/types';
import styles from './UploadModal.module.css';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookAdded: (book: Book) => void;
}

export default function UploadModal({ isOpen, onClose, onBookAdded }: UploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus management, scroll lock, Escape + focus trap
  useEffect(() => {
    if (!isOpen) return;

    lastFocused.current = document.activeElement as HTMLElement | null;
    setErrorMessage('');
    setNotice('');
    setIsDragging(false);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const raf = requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const dialogEl = dialogRef.current;
        const focusables = Array.from(
          dialogEl.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled'));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!dialogEl.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      lastFocused.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (files.length > 1) {
      setNotice(`Adding one book at a time — “${files[0].name}” selected`);
    } else {
      setNotice('');
    }

    const file = files[0];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'epub') {
      setErrorMessage(
        `“${file.name}” isn’t a PDF or EPUB file. Please choose a supported book file (.pdf or .epub).`
      );
      return;
    }

    setErrorMessage('');

    try {
      setIsProcessing(true);
      setStatusMessage('Extracting book metadata and cover...');

      const meta = await parseBookFile(file);
      const fileData = await file.arrayBuffer();

      const newBook: Book = {
        id: crypto.randomUUID(),
        title: meta.title,
        author: meta.author,
        format: meta.format,
        file_path: `${file.name}`,
        file_size: file.size,
        cover_data_url: meta.coverDataUrl,
        total_pages: meta.totalPages,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setStatusMessage('Saving to your local library...');
      const mime = meta.format === 'pdf' ? 'application/pdf' : 'application/epub+zip';
      await saveLocalBook(newBook, fileData, mime);

      // If cloud is configured, sync in background
      if (isCloudConfigured()) {
        setStatusMessage('Syncing book to cloud storage...');
        try {
          await uploadBookToCloud(newBook, fileData);
        } catch (cloudErr) {
          console.warn('Cloud upload deferred:', cloudErr);
        }
      }

      onBookAdded(newBook);
      onClose();
    } catch (err) {
      console.error('Failed to process book:', err);
      setErrorMessage(
        `We couldn’t read “${file.name}”. The file may be damaged or use an unsupported PDF/EPUB version — try another file.`
      );
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
        aria-describedby={errorMessage ? 'upload-error' : notice ? 'upload-notice' : undefined}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="upload-modal-title" className={styles.title}>
            Add Book to Library
          </h2>
          <button
            onClick={onClose}
            ref={closeBtnRef}
            className={styles.closeBtn}
            aria-label="Close dialog"
            title="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {errorMessage && (
          <div className={styles.errorBox} role="alert" id="upload-error">
            <AlertCircle size={18} className={styles.errorIcon} aria-hidden="true" />
            <p className={styles.errorText}>{errorMessage}</p>
          </div>
        )}

        {notice && !errorMessage && (
          <div className={styles.infoBox} role="status" id="upload-notice">
            <p className={styles.infoText}>{notice}</p>
          </div>
        )}

        {isProcessing ? (
          <div className={styles.progressContainer}>
            <div className={styles.progressLabel}>
              <span>{statusMessage}</span>
              <Loader2 size={18} className={styles.spinner} aria-hidden="true" />
            </div>
          </div>
        ) : (
          <div
            className={`${styles.dropzone} ${isDragging ? styles.dragOver : ''}`}
            onDragOver={onDragOver}
            onDragEnter={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.epub,application/pdf,application/epub+zip"
              className={styles.hiddenInput}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <div className={styles.dropzoneBody}>
              <UploadCloud className={styles.uploadIcon} aria-hidden="true" />
              <div>
                <p className={styles.dropTitle}>Click to upload or drag &amp; drop</p>
                <p className={styles.dropSubtitle}>Supports PDF and EPUB files up to 100MB</p>
              </div>
            </div>
            <button
              type="button"
              className={styles.browseBtn}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Choose file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
