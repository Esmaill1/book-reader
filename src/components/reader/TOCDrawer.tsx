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
  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Table of Contents</h2>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Close contents">
            <X size={20} />
          </button>
        </div>

        <div className={styles.list}>
          {items.length > 0 ? (
            items.map((item, idx) => (
              <button
                key={item.id || idx}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                className={styles.item}
              >
                <span className={styles.itemLabel} title={item.label}>
                  {item.label}
                </span>
                <ChevronRight size={16} color="var(--text-muted)" />
              </button>
            ))
          ) : (
            <div className={styles.empty}>
              No table of contents available for this document.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
