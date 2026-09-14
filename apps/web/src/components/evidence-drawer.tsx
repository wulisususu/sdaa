"use client";

import type { SearchEvidenceItem } from "@ask-better/domain";
import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";

interface EvidenceDrawerProps {
  open: boolean;
  items: SearchEvidenceItem[];
  onClose: () => void;
  /**
   * The trigger to return focus to on close. A ref is used rather than the element captured
   * from `document.activeElement`: React may replace the toggle's DOM node while the drawer is
   * open, which left focus on `<body>` instead of the control the user came from.
   */
  restoreFocusTo?: RefObject<HTMLElement | null>;
}

export const DRAWER_FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Index of the element that should receive focus for a Tab/Shift+Tab keypress.
 *
 * Pure so the trap boundary rules are unit-testable without a DOM: returns -1 when focus is
 * outside the list (the caller then pulls focus back to the appropriate edge), otherwise the
 * wrapped target index so focus can never leave the dialog.
 */
export function getTrappedFocusIndex(
  count: number,
  activeIndex: number,
  shiftKey: boolean
): number {
  if (count <= 0) return -1;
  if (activeIndex < 0) return shiftKey ? count - 1 : 0;
  if (shiftKey) return activeIndex === 0 ? count - 1 : activeIndex - 1;
  return activeIndex === count - 1 ? 0 : activeIndex + 1;
}

/** Index of the element that should take initial focus when the dialog opens. */
export function getInitialFocusIndex(count: number): number {
  return count > 0 ? 0 : -1;
}

function focusableIn(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(DRAWER_FOCUSABLE_SELECTOR)].filter(
    (element) => element.offsetParent !== null || element === document.activeElement
  );
}


export interface EvidenceDrawerContentProps {
  items: SearchEvidenceItem[];
  onClose: () => void;
  dialogRef?: React.Ref<HTMLElement>;
  closeButtonRef?: React.Ref<HTMLButtonElement>;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

/**
 * The dialog body. Split out from the portal wrapper so its semantics can be asserted with
 * static rendering (the project runs vitest without a DOM environment).
 */
export function EvidenceDrawerContent({
  items,
  onClose,
  dialogRef,
  closeButtonRef,
  onKeyDown
}: EvidenceDrawerContentProps) {
  return (
    <section
      ref={dialogRef}
      className="evidence-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="全部参考来源"
      tabIndex={-1}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      <header className="evidence-drawer-header">
        <strong>全部参考来源</strong>
        <button ref={closeButtonRef} type="button" className="ghost-button" onClick={onClose}>
          关闭
        </button>
      </header>
      <div className="evidence-drawer-scroll">
        {items.map((item) => (
          <article className="evidence-source-item" key={`${item.id}-${item.url}`}>
            <a href={item.url} target="_blank" rel="noreferrer">
              <span>{item.title}</span>
              <span className="evidence-link-arrow" aria-hidden="true">↗</span>
            </a>
            {item.summary && <p>{item.summary}</p>}
            <div className="evidence-source-meta">
              <span>{item.author || "知乎用户"}</span>
              <span>赞同 {item.voteUpCount}</span>
              <span>评论 {item.commentCount}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function EvidenceDrawer({ open, items, onClose, restoreFocusTo }: EvidenceDrawerProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Background is non-interactive while open: `inert` blocks pointer, touch, keyboard and AT.
  // This effect also owns focus restoration, and it must run BEFORE the trigger-focus effect's
  // cleanup: a browser refuses to focus an element that is still inside an `inert` subtree.
  useEffect(() => {
    if (!open) return;
    const appRoot = document.querySelector<HTMLElement>(".app-shell");
    const previouslyInert = appRoot?.hasAttribute("inert") ?? false;
    if (appRoot) appRoot.setAttribute("inert", "");

    return () => {
      if (appRoot && !previouslyInert) appRoot.removeAttribute("inert");
      // Defer past this cleanup pass so the subtree is interactive again before focusing,
      // and resolve the target through the ref so a replaced node is still reachable.
      queueMicrotask(() => {
        const target = restoreFocusTo?.current;
        if (target && document.contains(target)) target.focus();
      });
    };
  }, [open, restoreFocusTo]);

  // Initial focus enters the dialog.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusables = focusableIn(dialog);
    const index = getInitialFocusIndex(focusables.length);
    if (index >= 0) focusables[index].focus();
    else dialog.focus();
  }, [open]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = focusableIn(dialog);
      const activeIndex = focusables.indexOf(document.activeElement as HTMLElement);
      const targetIndex = getTrappedFocusIndex(focusables.length, activeIndex, event.shiftKey);

      if (targetIndex < 0) {
        event.preventDefault();
        return;
      }
      // Always take over Tab: the dialog must not hand focus to the page behind it.
      event.preventDefault();
      focusables[targetIndex].focus();
    },
    [onClose]
  );

  // Server rendering has no portal target.
  if (typeof document === "undefined") return null;
  if (!open) return null;

  return createPortal(
    <div className="evidence-drawer-backdrop" onMouseDown={onClose}>
      <EvidenceDrawerContent
        items={items}
        onClose={onClose}
        dialogRef={dialogRef}
        closeButtonRef={closeButtonRef}
        onKeyDown={handleKeyDown}
      />
    </div>,
    document.body
  );
}
