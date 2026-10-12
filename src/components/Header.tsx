'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Sun, Coffee, Moon, Sparkles, Plus } from 'lucide-react';
import { ReadingTheme } from '@/types';
import { isCloudConfigured } from '@/lib/supabase';
import styles from './Header.module.css';

interface HeaderProps {
  onOpenUpload: () => void;
}

export default function Header({ onOpenUpload }: HeaderProps) {
  const [theme, setTheme] = useState<ReadingTheme>('night');
  const [cloudReady, setCloudReady] = useState<boolean>(false);

  useEffect(() => {
    const saved = (localStorage.getItem('bookera_theme') as ReadingTheme) || 'night';
    setTheme(saved);
    setCloudReady(isCloudConfigured());
  }, []);

  const changeTheme = (newTheme: ReadingTheme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('bookera_theme', newTheme);
  };

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        <Link href="/" className={styles.brand}>
          <BookOpen className={styles.logoIcon} />
          <span>BookEra</span>
        </Link>
        <div className={styles.syncBadge} title={cloudReady ? "Cloud Sync Active" : "Local Storage Mode (Offline ready)"}>
          <span className={`${styles.statusDot} ${cloudReady ? styles.online : styles.local}`} />
          <span>{cloudReady ? 'Cloud Synced' : 'Local Library'}</span>
        </div>
      </div>

      <div className={styles.rightSection}>
        <div className={styles.themeSelector} title="Switch Reading Theme">
          <button
            onClick={() => changeTheme('day')}
            className={`${styles.themeBtn} ${theme === 'day' ? styles.active : ''}`}
            aria-label="Day Theme"
            title="Day (Clean Light)"
          >
            <Sun size={17} />
          </button>
          <button
            onClick={() => changeTheme('sepia')}
            className={`${styles.themeBtn} ${theme === 'sepia' ? styles.active : ''}`}
            aria-label="Sepia Theme"
            title="Sepia (Warm Paper)"
          >
            <Coffee size={17} />
          </button>
          <button
            onClick={() => changeTheme('night')}
            className={`${styles.themeBtn} ${theme === 'night' ? styles.active : ''}`}
            aria-label="Night Theme"
            title="Night (Dark Slate)"
          >
            <Moon size={17} />
          </button>
          <button
            onClick={() => changeTheme('oled')}
            className={`${styles.themeBtn} ${theme === 'oled' ? styles.active : ''}`}
            aria-label="OLED Black Theme"
            title="OLED (Pure Pitch Black)"
          >
            <Sparkles size={17} />
          </button>
        </div>

        <button onClick={onOpenUpload} className={styles.uploadBtn}>
          <Plus size={18} />
          <span>Add Book</span>
        </button>
      </div>
    </header>
  );
}
