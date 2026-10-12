'use client';

import React, { useState, useRef } from 'react';
import { X, UploadCloud, Loader2 } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'epub') {
      alert('Please upload a PDF or EPUB book file.');
      return;
    }

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
      alert('Could not parse this book file. Please try another file.');
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Add Book to Library</h2>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {isProcessing ? (
          <div className={styles.progressContainer}>
            <div className={styles.progressLabel}>
              <span>{statusMessage}</span>
              <Loader2 size={18} className={styles.spinner} />
            </div>
          </div>
        ) : (
          <div
            className={`${styles.dropzone} ${isDragging ? styles.active : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud className={styles.uploadIcon} />
            <div>
              <p className={styles.dropTitle}>Click to upload or drag & drop</p>
              <p className={styles.dropSubtitle}>Supports PDF and EPUB files up to 100MB</p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.epub,application/pdf,application/epub+zip"
              className={styles.hiddenInput}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
