// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import type { QuestionSessionSummaryV2 } from "../lib/question-session-storage";
import { SessionHistoryDrawer } from "./session-history-drawer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

const sessions: QuestionSessionSummaryV2[] = [
  {
    conversationId: "conv-new",
    rawQuestion: "预算 5000，大学生第一台相机怎么选？",
    stage: "clarify",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_002_000
  },
  {
    conversationId: "conv-old",
    rawQuestion: "考公还是考研更适合我？",
    stage: "result",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_001_000
  }
];

async function renderDrawer({
  sessions: nextSessions,
  open,
  activeConversationId = null,
  onClose = vi.fn(),
  onSelect = vi.fn()
}: {
  sessions: QuestionSessionSummaryV2[];
  open: boolean;
  activeConversationId?: string | null;
  onClose?: () => void;
  onSelect?: (conversationId: string) => void;
}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <SessionHistoryDrawer
        open={open}
        sessions={nextSessions}
        activeConversationId={activeConversationId}
        onClose={onClose}
        onSelect={onSelect}
      />
    );
  });
}

async function click(element: Element | null) {
  expect(element).not.toBeNull();
  await act(async () => {
    element?.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }));
    element?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
}

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  root = undefined;
  container?.remove();
  container = undefined;
  vi.restoreAllMocks();
});

test("renders nothing when closed", async () => {
  await renderDrawer({ sessions, open: false });
  expect(container?.querySelector(".history-drawer")).toBeNull();
});

test("renders recent sessions newest-first with stage labels", async () => {
  await renderDrawer({ sessions, open: true });

  const rows = Array.from(container?.querySelectorAll<HTMLButtonElement>(".history-row") ?? []);
  expect(rows).toHaveLength(2);
  expect(rows[0]?.textContent).toContain("预算 5000");
  expect(rows[0]?.textContent).toContain("补充信息");
  expect(rows[1]?.textContent).toContain("考公还是考研");
  expect(rows[1]?.textContent).toContain("编译结果");
});

test("selecting a row returns its conversation id", async () => {
  const onSelect = vi.fn();
  await renderDrawer({ sessions, open: true, onSelect });

  await click(container?.querySelectorAll<HTMLButtonElement>(".history-row")[1] ?? null);

  expect(onSelect).toHaveBeenCalledWith("conv-old");
});

test("marks the active session row", async () => {
  await renderDrawer({ sessions, open: true, activeConversationId: "conv-old" });

  const rows = Array.from(container?.querySelectorAll<HTMLButtonElement>(".history-row") ?? []);
  expect(rows[0]?.getAttribute("data-active")).toBe("false");
  expect(rows[1]?.getAttribute("data-active")).toBe("true");
});

test("exposes accessible dialog semantics", async () => {
  await renderDrawer({ sessions, open: true });

  const dialog = container?.querySelector(".history-drawer");
  expect(dialog?.getAttribute("role")).toBe("dialog");
  expect(dialog?.getAttribute("aria-modal")).toBe("true");
  expect(dialog?.getAttribute("aria-labelledby")).toBe("history-title");
  expect(container?.querySelector("#history-title")?.textContent).toBe("最近提问");
});

test("Escape closes the drawer", async () => {
  const onClose = vi.fn();
  await renderDrawer({ sessions, open: true, onClose });

  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
  });

  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Escape does not fire while the drawer is closed", async () => {
  const onClose = vi.fn();
  await renderDrawer({ sessions, open: false, onClose });

  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
  });

  expect(onClose).not.toHaveBeenCalled();
});

test("backdrop click closes but panel click does not", async () => {
  const onClose = vi.fn();
  await renderDrawer({ sessions, open: true, onClose });

  await click(container?.querySelector<HTMLElement>(".history-drawer") ?? null);
  expect(onClose).not.toHaveBeenCalled();

  await click(container?.querySelector<HTMLElement>(".history-overlay") ?? null);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("shows an empty state when there is no history", async () => {
  await renderDrawer({ sessions: [], open: true });

  expect(container?.querySelectorAll(".history-row")).toHaveLength(0);
  expect(container?.textContent).toContain("还没有历史提问");
});
