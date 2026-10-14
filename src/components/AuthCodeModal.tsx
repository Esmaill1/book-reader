'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Key,
  Copy,
  Check,
  Share2,
  RefreshCw,
  Database,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import {
  getLibraryCode,
  setLibraryCode,
  generateLibraryCode,
  getShareableLibraryUrl,
} from '@/lib/auth';
import { checkCloudHealth } from '@/lib/supabase';
import styles from './AuthCodeModal.module.css';

interface AuthCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCodeChanged?: (newCode: string) => void;
}

const SCHEMA_SQL_SNIPPET = `-- Run this in Supabase Dashboard -> SQL Editor:
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
CREATE INDEX IF NOT EXISTS idx_books_library_code ON public.books(library_code);

CREATE TABLE IF NOT EXISTS public.reading_sessions (
    book_id TEXT PRIMARY KEY REFERENCES public.books(id) ON DELETE CASCADE,
    library_code TEXT,
    current_page INTEGER DEFAULT 1,
    current_cfi TEXT,
    progress_percent INTEGER DEFAULT 0,
    last_read_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_library_code ON public.reading_sessions(library_code);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Books All" ON public.books FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Sessions All" ON public.reading_sessions FOR ALL USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('user-books', 'user-books', true) ON CONFLICT (id) DO UPDATE SET public = true;
CREATE POLICY "Public Storage All" ON storage.objects FOR ALL USING (bucket_id = 'user-books') WITH CHECK (bucket_id = 'user-books');`;

export default function AuthCodeModal({
  isOpen,
  onClose,
  onCodeChanged,
}: AuthCodeModalProps) {
  const [currentCode, setCurrentCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cloudStatus, setCloudStatus] = useState<{
    configured: boolean;
    connected: boolean;
    tablesReady: boolean;
    storageReady: boolean;
  }>({
    configured: false,
    connected: false,
    tablesReady: false,
    storageReady: false,
  });
  const [showSql, setShowSql] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const code = getLibraryCode();
    setCurrentCode(code);
    setInputCode('');
    setFeedback(null);
    setCopiedCode(false);
    setCopiedLink(false);

    // Check Cloud Status
    checkCloudHealth().then((health) => {
      setCloudStatus(health);
      if (health.connected && (!health.tablesReady || !health.storageReady)) {
        setShowSql(true);
      }
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = getShareableLibraryUrl(currentCode);
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SCHEMA_SQL_SNIPPET);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (!clean || clean.length < 3) {
      setFeedback({ type: 'error', text: 'Please enter a valid code (at least 3 characters).' });
      return;
    }

    try {
      setLibraryCode(clean);
      setCurrentCode(clean);
      setInputCode('');
      setFeedback({
        type: 'success',
        text: `Connected to library "${clean}"! Your library and reading progress are now in sync.`,
      });
      onCodeChanged?.(clean);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Could not connect to this library.' });
    }
  };

  const handleGenerateNew = () => {
    if (
      window.confirm(
        'Generate a new personal library code? Make sure you have copied your current code if you want to access your existing books again later.'
      )
    ) {
      const fresh = generateLibraryCode();
      setLibraryCode(fresh);
      setCurrentCode(fresh);
      setFeedback({
        type: 'success',
        text: `New library created with code "${fresh}".`,
      });
      onCodeChanged?.(fresh);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <Key className={styles.titleIcon} size={22} aria-hidden="true" />
            <h2 id="auth-modal-title" className={styles.title}>
              Library Access & Sync
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="Close dialog"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className={styles.description}>
          Access your personal library and reading progress from any phone, tablet, or computer.
          Your Library Auth Code keeps your books linked across all your devices.
        </p>

        {feedback && (
          <div
            className={`${styles.feedback} ${
              feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} aria-hidden="true" />
            ) : (
              <AlertTriangle size={16} aria-hidden="true" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Current Active Library Code */}
        <div className={styles.currentCodeCard}>
          <div className={styles.codeHeader}>
            <span>Your Active Library Code</span>
            <div className={styles.activeBadge}>
              <span className={styles.activeDot} />
              <span>Current</span>
            </div>
          </div>

          <div className={styles.codeDisplay}>
            <span className={styles.codeString}>{currentCode || 'LOADING...'}</span>
            <div className={styles.codeActions}>
              <button
                onClick={handleCopyCode}
                className={styles.copyBtn}
                title="Copy code to clipboard"
              >
                {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={handleCopyLink}
                className={styles.copyLinkBtn}
                title="Copy instant device-login link"
              >
                {copiedLink ? <Check size={14} /> : <Share2 size={14} />}
                <span>{copiedLink ? 'Link Copied' : 'Share Link'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Connect to Another Device / Enter Existing Code */}
        <form onSubmit={handleConnect} className={styles.connectSection}>
          <label htmlFor="library-code-input" className={styles.sectionLabel}>
            Switch or Connect to Existing Library
          </label>
          <div className={styles.connectRow}>
            <input
              id="library-code-input"
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="e.g. ERA-7X49-B2K8"
              className={styles.input}
              autoComplete="off"
              spellCheck="false"
            />
            <button
              type="submit"
              disabled={!inputCode.trim()}
              className={styles.connectBtn}
            >
              <span>Connect</span>
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </form>

        {/* Cloud Health Diagnostics */}
        <div className={styles.cloudStatusBox}>
          <div className={styles.statusHeader}>
            <div className={styles.statusIndicator}>
              <Database size={15} aria-hidden="true" />
              <span>
                {cloudStatus.connected && cloudStatus.tablesReady && cloudStatus.storageReady
                  ? 'Cloud Sync: Active & Ready'
                  : cloudStatus.connected
                  ? 'Cloud: Tables Setup Needed'
                  : 'Mode: Local Storage (Offline)'}
              </span>
            </div>
            {cloudStatus.connected && (!cloudStatus.tablesReady || !cloudStatus.storageReady) && (
              <button
                type="button"
                onClick={() => setShowSql(!showSql)}
                className={styles.sqlHelperBtn}
              >
                {showSql ? 'Hide SQL' : 'Setup SQL'}
              </button>
            )}
          </div>

          {showSql && (
            <div className={styles.sqlHelperContent}>
              <p className={styles.description} style={{ fontSize: '0.8rem' }}>
                Paste and run this query once in Supabase Dashboard → SQL Editor to enable multi-device sync:
              </p>
              <div className={styles.sqlCodeBlock}>{SCHEMA_SQL_SNIPPET}</div>
              <button onClick={handleCopySql} className={styles.copyBtn} style={{ alignSelf: 'flex-start' }}>
                {copiedSql ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedSql ? 'SQL Copied!' : 'Copy SQL Script'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Generate Fresh Code Option */}
        <div className={styles.generateRow}>
          <button
            type="button"
            onClick={handleGenerateNew}
            className={styles.generateBtn}
          >
            <RefreshCw size={13} style={{ display: 'inline', marginRight: 4 }} />
            Create a fresh new library code
          </button>
        </div>
      </div>
    </div>
  );
}
