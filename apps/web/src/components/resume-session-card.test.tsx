import React, { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { QuestionSessionSummaryV2 } from "../lib/question-session-storage";
import { ResumeSessionCard } from "./resume-session-card";

function collectButtons(node: ReactNode): ReactElement<{ onClick?: () => void }>[] {
  if (Array.isArray(node)) return node.flatMap(collectButtons);
  if (!isValidElement(node)) return [];
  const self = node.type === "button" ? [node as ReactElement<{ onClick?: () => void }>] : [];
  const children = (node.props as { children?: ReactNode }).children;
  return [...self, ...collectButtons(children)];
}

const summary: QuestionSessionSummaryV2 = {
  conversationId: "conv-resume",
  rawQuestion: "现在转码还有前途吗？",
  stage: "clarify",
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_300_000
};

describe("resume session card", () => {
  test("renders the summary question and both recovery actions", () => {
    const html = renderToStaticMarkup(
      <ResumeSessionCard session={summary} onResume={() => undefined} onDismiss={() => undefined} />
    );

    expect(html).toContain(summary.rawQuestion);
    expect(html).toContain("继续上次");
    expect(html).toContain("新问题");
  });

  test("does not require analysis, retrieval or compiled payloads", () => {
    // A summary is enough: an in-progress session may have no downstream payload at all.
    const minimal: QuestionSessionSummaryV2 = {
      conversationId: "conv-minimal",
      rawQuestion: "买",
      stage: "input",
      createdAt: 1,
      updatedAt: 2
    };
    const html = renderToStaticMarkup(
      <ResumeSessionCard session={minimal} onResume={() => undefined} onDismiss={() => undefined} />
    );

    expect(html).toContain("买");
  });

  test("uses the thin-line history and plus icons", () => {
    const html = renderToStaticMarkup(
      <ResumeSessionCard session={summary} onResume={() => undefined} onDismiss={() => undefined} />
    );

    expect(html).toContain('data-icon="history"');
    expect(html).toContain('data-icon="plus"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="1.8"');
    expect(html).toContain('aria-hidden="true"');
  });

  test("renders no explanatory helper copy", () => {
    const html = renderToStaticMarkup(
      <ResumeSessionCard session={summary} onResume={() => undefined} onDismiss={() => undefined} />
    );

    expect(html).not.toContain("<small");
    expect(html).not.toContain("检测到");
    expect(html).not.toContain("欢迎回来");
    expect(html).not.toContain("上次还有一个未完成");
    expect(html).not.toContain("新标签页");
  });

  test("继续上次 invokes onResume and 新问题 invokes onDismiss", () => {
    let resumed = 0;
    let dismissed = 0;
    const tree = ResumeSessionCard({
      session: summary,
      onResume: () => {
        resumed += 1;
      },
      onDismiss: () => {
        dismissed += 1;
      }
    });

    const buttons = collectButtons(tree);
    expect(buttons).toHaveLength(2);

    buttons[0].props.onClick?.();
    expect(resumed).toBe(1);
    expect(dismissed).toBe(0);

    buttons[1].props.onClick?.();
    expect(resumed).toBe(1);
    expect(dismissed).toBe(1);
  });
});
