"use client";

import { stageLabels } from "@ask-better/domain";
import { useEffect, type MouseEvent as ReactMouseEvent } from "react";
import type { QuestionSessionSummaryV2 } from "../lib/question-session-storage";

interface SessionHistoryDrawerProps {
  open: boolean;
  sessions: QuestionSessionSummaryV2[];
  activeConversationId: string | null;
  onClose: () => void;
  onSelect: (conversationId: string) => void;
}

const historyTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function formatHistoryTime(timestamp: number): string {
  return historyTimeFormatter.format(new Date(timestamp));
}

function onBackdropMouseDown(event: ReactMouseEvent<HTMLDivElement>, onClose: () => void) {
  if (event.target === event.currentTarget) onClose();
}

/**
 * Recent-question overlay. Opened from the header so the five-scene one-viewport composition
 * stays intact; it is not a permanent sidebar.
 */
export function SessionHistoryDrawer({
  open,
  sessions,
  activeConversationId,
  onClose,
  onSelect
}: SessionHistoryDrawerProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="history-overlay" role="presentation" onMouseDown={(event) => onBackdropMouseDown(event, onClose)}>
      <section
        className="history-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="history-drawer-header">
          <h2 id="history-title">最近提问</h2>
          <button type="button" className="ghost-button" onClick={onClose}>关闭</button>
        </header>
        <div className="history-list">
          {sessions.length === 0 ? (
            <p className="history-empty">还没有历史提问</p>
          ) : (
            sessions.map((session) => (
              <button
                type="button"
                className="history-row"
                data-active={session.conversationId === activeConversationId ? "true" : "false"}
                key={session.conversationId}
                onClick={() => onSelect(session.conversationId)}
              >
                <strong>{session.rawQuestion.trim() || "未命名问题"}</strong>
                <span>{stageLabels[session.stage]} · {formatHistoryTime(session.updatedAt)}</span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
