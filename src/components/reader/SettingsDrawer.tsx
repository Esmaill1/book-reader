'use client';

import React from 'react';
import { X } from 'lucide-react';
import { ReadingTheme, ReaderSettings, BookFormat } from '@/types';
import styles from './SettingsDrawer.module.css';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  format: BookFormat;
  settings: ReaderSettings;
  onUpdateSettings: (updater: (prev: ReaderSettings) => ReaderSettings) => void;
}

const THEMES: Array<{ value: ReadingTheme; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'night', label: 'Night' },
  { value: 'oled', label: 'OLED' },
];

const FONTS: Array<{
  value: ReaderSettings['typography']['fontFamily'];
  label: string;
  css: string;
}> = [
  { value: 'sans', label: 'Inter (Sans)', css: 'var(--font-sans)' },
  { value: 'serif', label: 'Merriweather', css: 'var(--font-serif)' },
  { value: 'cairo', label: 'Cairo (عربي)', css: 'Cairo' },
  { value: 'amiri', label: 'Amiri (نسخ)', css: 'Amiri' },
];

const LINE_SPACINGS: Array<{ value: number; label: string }> = [
  { value: 1.3, label: 'Cozy (1.3x)' },
  { value: 1.6, label: 'Normal (1.6x)' },
  { value: 2.0, label: 'Spacious (2x)' },
];

const MARGINS: Array<{ value: 'narrow' | 'normal' | 'wide'; label: string }> = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Wide' },
];

const FONT_MIN = 12;
const FONT_MAX = 36;
const DEFAULT_FONT_SIZE = 18;
const ZOOM_MIN = 50;
const ZOOM_MAX = 300;
const DEFAULT_ZOOM = 100;

export default function SettingsDrawer({
  isOpen,
  onClose,
  format,
  settings,
  onUpdateSettings,
}: SettingsDrawerProps) {
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!isOpen) return undefined;
    const drawer = drawerRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    drawer?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !drawer) return;
      const focusables = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = drawer.contains(active);
      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleThemeChange = (theme: ReadingTheme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('bookera_theme', theme);
    onUpdateSettings((prev) => ({ ...prev, theme }));
  };

  const zoomPct = Math.round((settings.pdfView.customZoom || 1.0) * 100);
  const resetTypography = () =>
    onUpdateSettings((prev) => ({
      ...prev,
      typography: { ...prev.typography, fontSize: DEFAULT_FONT_SIZE },
    }));
  const resetZoom = () =>
    onUpdateSettings((prev) => ({
      ...prev,
      pdfView: { ...prev.pdfView, zoomMode: 'custom', customZoom: 1.0 },
    }));

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Reader Settings"
        tabIndex={-1}
        className={styles.drawer}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Reader Settings</h2>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.content}>
          {/* Theme */}
          <section className={styles.section}>
            <h3 id="settings-theme-heading" className={styles.sectionLabel}>
              Theme
            </h3>
            <div
              role="radiogroup"
              aria-labelledby="settings-theme-heading"
              className={styles.themeGrid}
            >
              {THEMES.map((theme) => (
                <button
                  key={theme.value}
                  type="button"
                  role="radio"
                  aria-checked={settings.theme === theme.value}
                  onClick={() => handleThemeChange(theme.value)}
                  className={styles.themeOption}
                  data-active={settings.theme === theme.value || undefined}
                >
                  <span
                    className={`${styles.swatch} ${styles[`swatch_${theme.value}`]}`}
                    aria-hidden="true"
                  />
                  <span>{theme.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* EPUB typography */}
          {format === 'epub' && (
            <section className={styles.section}>
              <h3 id="settings-typography-heading" className={styles.sectionLabel}>
                Typography
              </h3>

              <div className={styles.controlGroup}>
                <span id="settings-font-family-label" className={styles.controlLabel}>
                  Font family
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="settings-font-family-label"
                  className={styles.fontGrid}
                >
                  {FONTS.map((font) => (
                    <button
                      key={font.value}
                      type="button"
                      role="radio"
                      aria-checked={settings.typography.fontFamily === font.value}
                      onClick={() =>
                        onUpdateSettings((prev) => ({
                          ...prev,
                          typography: { ...prev.typography, fontFamily: font.value },
                        }))
                      }
                      className={styles.fontBtn}
                      style={{ fontFamily: font.css }}
                      data-active={settings.typography.fontFamily === font.value || undefined}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.controlGroup}>
                <div className={styles.controlRow}>
                  <span id="settings-font-size-label" className={styles.controlLabel}>
                    Font size ({settings.typography.fontSize}px)
                  </span>
                  <button
                    type="button"
                    onClick={resetTypography}
                    className={styles.resetBtn}
                    aria-label="Reset font size to default (18px)"
                  >
                    Default
                  </button>
                </div>
                <div className={styles.sliderRow}>
                  <input
                    type="range"
                    min={FONT_MIN}
                    max={FONT_MAX}
                    value={settings.typography.fontSize}
                    aria-label="Font size"
                    aria-valuemin={FONT_MIN}
                    aria-valuemax={FONT_MAX}
                    aria-valuetext={`${settings.typography.fontSize} pixels`}
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

              <div className={styles.controlGroup}>
                <span id="settings-line-spacing-label" className={styles.controlLabel}>
                  Line spacing
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="settings-line-spacing-label"
                  className={styles.buttonGroup}
                >
                  {LINE_SPACINGS.map((spacing) => (
                    <button
                      key={spacing.value}
                      type="button"
                      role="radio"
                      aria-checked={settings.typography.lineHeight === spacing.value}
                      onClick={() =>
                        onUpdateSettings((prev) => ({
                          ...prev,
                          typography: { ...prev.typography, lineHeight: spacing.value },
                        }))
                      }
                      className={styles.groupBtn}
                      data-active={settings.typography.lineHeight === spacing.value || undefined}
                    >
                      {spacing.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.controlGroup}>
                <span id="settings-margins-label" className={styles.controlLabel}>
                  Margins
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="settings-margins-label"
                  className={styles.buttonGroup}
                >
                  {MARGINS.map((margin) => (
                    <button
                      key={margin.value}
                      type="button"
                      role="radio"
                      aria-checked={settings.typography.margin === margin.value}
                      onClick={() =>
                        onUpdateSettings((prev) => ({
                          ...prev,
                          typography: { ...prev.typography, margin: margin.value },
                        }))
                      }
                      className={styles.groupBtn}
                      data-active={settings.typography.margin === margin.value || undefined}
                    >
                      {margin.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* PDF page view */}
          {format === 'pdf' && (
            <section className={styles.section}>
              <h3 id="settings-page-view-heading" className={styles.sectionLabel}>
                Page View
              </h3>
              <div
                role="radiogroup"
                aria-labelledby="settings-page-view-heading"
                className={styles.buttonGroup}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.pdfView.scrollMode === 'continuous'}
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      pdfView: { ...prev.pdfView, scrollMode: 'continuous' },
                    }))
                  }
                  className={styles.groupBtn}
                  data-active={settings.pdfView.scrollMode === 'continuous' || undefined}
                >
                  Continuous
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.pdfView.scrollMode === 'single'}
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      pdfView: { ...prev.pdfView, scrollMode: 'single' },
                    }))
                  }
                  className={styles.groupBtn}
                  data-active={settings.pdfView.scrollMode === 'single' || undefined}
                >
                  Single Page
                </button>
              </div>
            </section>
          )}

          {format === 'pdf' && (
            <section className={styles.section}>
              <h3 id="settings-zoom-heading" className={styles.sectionLabel}>
                Zoom
              </h3>

              <div
                role="radiogroup"
                aria-labelledby="settings-zoom-heading"
                className={styles.buttonGroup}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.pdfView.zoomMode === 'fit-page'}
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      pdfView: { ...prev.pdfView, zoomMode: 'fit-page' },
                    }))
                  }
                  className={styles.groupBtn}
                  data-active={settings.pdfView.zoomMode === 'fit-page' || undefined}
                >
                  Fit Page
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.pdfView.zoomMode === 'fit-width'}
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      pdfView: { ...prev.pdfView, zoomMode: 'fit-width' },
                    }))
                  }
                  className={styles.groupBtn}
                  data-active={settings.pdfView.zoomMode === 'fit-width' || undefined}
                >
                  Fit Width
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.pdfView.zoomMode === 'custom' && zoomPct === 100}
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      pdfView: { ...prev.pdfView, zoomMode: 'custom', customZoom: 1.0 },
                    }))
                  }
                  className={styles.groupBtn}
                  data-active={
                    (settings.pdfView.zoomMode === 'custom' && zoomPct === 100) || undefined
                  }
                >
                  100%
                </button>
              </div>

              <div className={styles.controlGroup}>
                <div className={styles.controlRow}>
                  <span id="settings-zoom-level-label" className={styles.controlLabel}>
                    Zoom level ({zoomPct}%)
                  </span>
                  <button
                    type="button"
                    onClick={resetZoom}
                    className={styles.resetBtn}
                    aria-label="Reset zoom to default (100%)"
                  >
                    Default
                  </button>
                </div>
                <div className={styles.sliderRow}>
                  <input
                    type="range"
                    min={ZOOM_MIN}
                    max={ZOOM_MAX}
                    step={10}
                    value={zoomPct}
                    aria-label="Zoom"
                    aria-valuemin={ZOOM_MIN}
                    aria-valuemax={ZOOM_MAX}
                    aria-valuetext={`${zoomPct}%`}
                    onChange={(e) => {
                      const zoomVal = Number(e.target.value) / 100;
                      onUpdateSettings((prev) => ({
                        ...prev,
                        pdfView: {
                          ...prev.pdfView,
                          zoomMode: 'custom',
                          customZoom: zoomVal,
                        },
                      }));
                    }}
                    className={styles.sliderInput}
                  />
                  <span className={styles.sliderValue}>{zoomPct}%</span>
                </div>
              </div>
            </section>
          )}

          {format === 'pdf' && (
            <section className={styles.section}>
              <h3 id="settings-appearance-heading" className={styles.sectionLabel}>
                Appearance
              </h3>
              <div
                role="radiogroup"
                aria-labelledby="settings-appearance-heading"
                className={styles.buttonGroup}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={
                    !settings.pdfView.colorMode || settings.pdfView.colorMode === 'match-theme'
                  }
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      pdfView: { ...prev.pdfView, colorMode: 'match-theme' },
                    }))
                  }
                  className={styles.groupBtn}
                  data-active={
                    (!settings.pdfView.colorMode || settings.pdfView.colorMode === 'match-theme') ||
                    undefined
                  }
                >
                  Match Theme
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.pdfView.colorMode === 'original'}
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      pdfView: { ...prev.pdfView, colorMode: 'original' },
                    }))
                  }
                  className={styles.groupBtn}
                  data-active={settings.pdfView.colorMode === 'original' || undefined}
                >
                  Original Paper
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
