import { useEffect, useRef, type ReactNode } from 'react';
import { EXAMPLES, type Example } from '../data/examples';
import { Icon } from './Icon';

function useEscape(onEscape: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onEscape();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape]);
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEscape(onCancel);
  useEffect(() => confirmRef.current?.focus(), []);

  return (
    <div className="backdrop" onMouseDown={onCancel}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="dialog-title" className="dialog-title">
          {title}
        </h2>
        <p className="dialog-body">{body}</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button ref={confirmRef} type="button" className="btn btn-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Slides in from the right on wide screens, up from the bottom on phones. */
export function Drawer({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="backdrop backdrop-drawer" onMouseDown={onClose}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function MoreMenu({
  open,
  onToggle,
  onClose,
  onPick,
  onReset,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onPick: (example: Example) => void;
  onReset: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);
  useEscape(onClose);

  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="icon-btn" aria-expanded={open} aria-haspopup="menu" aria-label="More" title="More" onClick={onToggle}>
        <Icon name="more" size={17} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-heading">Try an example</div>
          {EXAMPLES.map((ex) => (
            <button key={ex.id} type="button" role="menuitem" className="menu-item" onClick={() => onPick(ex)}>
              <span className="menu-item-title">{ex.title}</span>
              <span className="menu-item-desc">{ex.description}</span>
            </button>
          ))}
          <div className="menu-divider" />
          <button type="button" role="menuitem" className="menu-item menu-item-row" onClick={onReset}>
            <Icon name="reset" size={14} />
            <span className="menu-item-title">Start over</span>
          </button>
        </div>
      )}
    </div>
  );
}
