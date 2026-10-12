'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Sun, Coffee, Moon, Sparkles, Plus, Wifi, WifiOff } from 'lucide-react';
import { ReadingTheme } from '@/types';
import { isCloudConfigured } from '@/lib/supabase';
import styles from './Header.module.css';

interface HeaderProps {
  onOpenUpload: () => void;
}

const THEMES: { id: ReadingTheme; name: string; hint: string; Icon: typeof Sun }[] = [
  { id: 'day', name: 'Day', hint: 'Clean Light', Icon: Sun },
  { id: 'sepia', name: 'Sepia', hint: 'Warm Paper', Icon: Coffee },
  { id: 'night', name: 'Night', hint: 'Dark Slate', Icon: Moon },
  { id: 'oled', name: 'OLED', hint: 'Pure Pitch Black', Icon: Sparkles },
];

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
          <BookOpen className={styles.logoIcon} aria-hidden="true" />
          <span>BookEra</span>
        </Link>
        <div className={styles.syncBadge} title={cloudReady ? 'Cloud Sync Active' : 'Local Storage Mode (Offline ready)'}>
          {cloudReady ? (
            <Wifi className={`${styles.statusIcon} ${styles.online}`} aria-hidden="true" />
          ) : (
            <WifiOff className={`${styles.statusIcon} ${styles.local}`} aria-hidden="true" />
          )}
          <span className={`${styles.statusDot} ${cloudReady ? styles.online : styles.local}`} aria-hidden="true" />
          <span>{cloudReady ? 'Cloud Synced' : 'Local Library'}</span>
        </div>
      </div>

      <nav className={styles.rightSection} aria-label="Library controls">
        <div className={styles.themeSelector} role="group" aria-label="Reading theme" title="Switch Reading Theme">
          {THEMES.map(({ id, name, hint, Icon }) => (
            <button
              key={id}
              onClick={() => changeTheme(id)}
              className={`${styles.themeBtn} ${theme === id ? styles.active : ''}`}
              aria-label={`${name} Theme`}
              aria-pressed={theme === id}
              title={`${name} (${hint})`}
            >
              <Icon size={17} aria-hidden="true" />
            </button>
          ))}
        </div>

        <button onClick={onOpenUpload} className={styles.uploadBtn}>
          <Plus size={18} aria-hidden="true" />
          <span>Add Book</span>
        </button>
      </nav>
    </header>
  );
}
