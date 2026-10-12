'use client';

import React from 'react';
import { X, Sun, Coffee, Moon, Sparkles } from 'lucide-react';
import { ReadingTheme, ReaderSettings, BookFormat } from '@/types';
import styles from './SettingsDrawer.module.css';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  format: BookFormat;
  settings: ReaderSettings;
  onUpdateSettings: (updater: (prev: ReaderSettings) => ReaderSettings) => void;
}

export default function SettingsDrawer({
  isOpen,
  onClose,
  format,
  settings,
  onUpdateSettings,
}: SettingsDrawerProps) {
  if (!isOpen) return null;

  const handleThemeChange = (theme: ReadingTheme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('bookera_theme', theme);
    onUpdateSettings((prev) => ({ ...prev, theme }));
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Reader Settings</h2>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Close settings">
            <X size={20} />
          </button>
        </div>

        {/* Themes (Available for both PDF and EPUB) */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Reading Theme</span>
          <div className={styles.themeGrid}>
            <button
              onClick={() => handleThemeChange('day')}
              className={`${styles.themeOption} ${settings.theme === 'day' ? styles.active : ''}`}
            >
              <Sun size={17} />
              <span>Day</span>
            </button>
            <button
              onClick={() => handleThemeChange('sepia')}
              className={`${styles.themeOption} ${settings.theme === 'sepia' ? styles.active : ''}`}
            >
              <Coffee size={17} />
              <span>Sepia</span>
            </button>
            <button
              onClick={() => handleThemeChange('night')}
              className={`${styles.themeOption} ${settings.theme === 'night' ? styles.active : ''}`}
            >
              <Moon size={17} />
              <span>Night</span>
            </button>
            <button
              onClick={() => handleThemeChange('oled')}
              className={`${styles.themeOption} ${settings.theme === 'oled' ? styles.active : ''}`}
            >
              <Sparkles size={17} />
              <span>OLED</span>
            </button>
          </div>
        </div>

        {/* EPUB Specific Settings */}
        {format === 'epub' && (
          <>
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Font Family</span>
              <div className={styles.fontGrid}>
                <button
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      typography: { ...prev.typography, fontFamily: 'sans' },
                    }))
                  }
                  className={`${styles.fontBtn} ${settings.typography.fontFamily === 'sans' ? styles.active : ''}`}
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  Inter (Sans)
                </button>
                <button
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      typography: { ...prev.typography, fontFamily: 'serif' },
                    }))
                  }
                  className={`${styles.fontBtn} ${settings.typography.fontFamily === 'serif' ? styles.active : ''}`}
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  Merriweather
                </button>
                <button
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      typography: { ...prev.typography, fontFamily: 'cairo' },
                    }))
                  }
                  className={`${styles.fontBtn} ${settings.typography.fontFamily === 'cairo' ? styles.active : ''}`}
                  style={{ fontFamily: 'Cairo' }}
                >
                  Cairo (عربي)
                </button>
                <button
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      typography: { ...prev.typography, fontFamily: 'amiri' },
                    }))
                  }
                  className={`${styles.fontBtn} ${settings.typography.fontFamily === 'amiri' ? styles.active : ''}`}
                  style={{ fontFamily: 'Amiri' }}
                >
                  Amiri (نسخ)
                </button>
              </div>
            </div>

            <div className={styles.section}>
              <span className={styles.sectionLabel}>Font Size ({settings.typography.fontSize}px)</span>
              <div className={styles.sliderRow}>
                <input
                  type="range"
                  min={14}
                  max={34}
                  value={settings.typography.fontSize}
                  onChange={(e) =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      typography: { ...prev.typography, fontSize: Number(e.target.value) },
                    }))
                  }
                  className={styles.sliderInput}
                />
                <span className={styles.sliderValue}>{settings.typography.fontSize}px</span>
              </div>
            </div>

            <div className={styles.section}>
              <span className={styles.sectionLabel}>Line Spacing</span>
              <div className={styles.buttonGroup}>
                {[1.3, 1.6, 2.0].map((spacing) => (
                  <button
                    key={spacing}
                    onClick={() =>
                      onUpdateSettings((prev) => ({
                        ...prev,
                        typography: { ...prev.typography, lineHeight: spacing },
                      }))
                    }
                    className={`${styles.groupBtn} ${
                      settings.typography.lineHeight === spacing ? styles.active : ''
                    }`}
                  >
                    {spacing}x
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <span className={styles.sectionLabel}>Margins</span>
              <div className={styles.buttonGroup}>
                {(['narrow', 'normal', 'wide'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() =>
                      onUpdateSettings((prev) => ({
                        ...prev,
                        typography: { ...prev.typography, margin: m },
                      }))
                    }
                    className={`${styles.groupBtn} ${
                      settings.typography.margin === m ? styles.active : ''
                    }`}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* PDF Specific Settings */}
        {format === 'pdf' && (
          <>
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Page Mode</span>
              <div className={styles.buttonGroup}>
                <button
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      pdfView: { ...prev.pdfView, scrollMode: 'continuous' },
                    }))
                  }
                  className={`${styles.groupBtn} ${
                    settings.pdfView.scrollMode === 'continuous' ? styles.active : ''
                  }`}
                >
                  Continuous
                </button>
                <button
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      pdfView: { ...prev.pdfView, scrollMode: 'single' },
                    }))
                  }
                  className={`${styles.groupBtn} ${
                    settings.pdfView.scrollMode === 'single' ? styles.active : ''
                  }`}
                >
                  Single Page
                </button>
              </div>
            </div>

            <div className={styles.section}>
              <span className={styles.sectionLabel}>Zoom Mode</span>
              <div className={styles.buttonGroup}>
                <button
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      pdfView: { ...prev.pdfView, zoomMode: 'fit-width' },
                    }))
                  }
                  className={`${styles.groupBtn} ${
                    settings.pdfView.zoomMode === 'fit-width' ? styles.active : ''
                  }`}
                >
                  Fit Width
                </button>
                <button
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      pdfView: { ...prev.pdfView, zoomMode: 'fit-page' },
                    }))
                  }
                  className={`${styles.groupBtn} ${
                    settings.pdfView.zoomMode === 'fit-page' ? styles.active : ''
                  }`}
                >
                  Fit Page
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
