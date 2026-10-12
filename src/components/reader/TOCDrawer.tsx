'use client';

import React from 'react';
import { X, ChevronRight } from 'lucide-react';
import styles from './TOCDrawer.module.css';

export interface TOCItem {
  id: string;
  label: string;
  href?: string;
  page?: number;
}

interface TOCDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: TOCItem[];
  onSelect: (item: TOCItem) => void;
}

export default function TOCDrawer({
  isOpen,
  onClose,
  items,
  onSelect,
}: TOCDrawerProps) {
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

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Table of Contents"
        tabIndex={-1}
        className={styles.drawer}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Table of Contents</h2>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.list}>
          {items.length > 0 ? (
            <ul className={styles.items} role="list">
              {items.map((item, idx) => (
                <li key={item.id || idx} className={styles.listRow}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(item);
                      onClose();
                    }}
                    className={styles.item}
                  >
                    <span className={styles.itemLabel} title={item.label}>
                      {item.label}
                    </span>
                    {item.page !== undefined && item.page !== null ? (
                      <span className={styles.itemPage}>p. {item.page}</span>
                    ) : (
                      <ChevronRight size={16} color="var(--text-muted)" aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>No table of contents for this book</div>
          )}
        </div>
      </div>
    </div>
  );
}
