import React, { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ResumeSessionCard } from "./resume-session-card";

function collectButtons(node: ReactNode): ReactElement<{ onClick?: () => void }>[] {
  if (Array.isArray(node)) return node.flatMap(collectButtons);
  if (!isValidElement(node)) return [];
  const self = node.type === "button" ? [node as ReactElement<{ onClick?: () => void }>] : [];
  const children = (node.props as { children?: ReactNode }).children;
  return [...self, ...collectButtons(children)];
}

const rawQuestion = "现在转码还有前途吗？";

describe("resume session card", () => {
  test("renders the previous raw question and both recovery actions", () => {
    const html = renderToStaticMarkup(
      <ResumeSessionCard rawQuestion={rawQuestion} onResume={() => undefined} onDiscard={() => undefined} />
    );

    expect(html).toContain(rawQuestion);
    expect(html).toContain("继续上次");
    expect(html).toContain("新问题");
  });

  test("uses the thin-line history and plus icons", () => {
    const html = renderToStaticMarkup(
      <ResumeSessionCard rawQuestion={rawQuestion} onResume={() => undefined} onDiscard={() => undefined} />
    );

    expect(html).toContain('data-icon="history"');
    expect(html).toContain('data-icon="plus"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="1.8"');
    expect(html).toContain('aria-hidden="true"');
  });

  test("renders no explanatory helper copy", () => {
    const html = renderToStaticMarkup(
      <ResumeSessionCard rawQuestion={rawQuestion} onResume={() => undefined} onDiscard={() => undefined} />
    );

    expect(html).not.toContain("<small");
    expect(html).not.toContain("检测到");
    expect(html).not.toContain("欢迎回来");
    expect(html).not.toContain("上次还有一个未完成");
    expect(html).not.toContain("新标签页");
  });

  test("继续上次 invokes onResume and 新问题 invokes onDiscard", () => {
    let resumed = 0;
    let discarded = 0;
    const tree = ResumeSessionCard({
      rawQuestion,
      onResume: () => {
        resumed += 1;
      },
      onDiscard: () => {
        discarded += 1;
      }
    });

    const buttons = collectButtons(tree);
    expect(buttons).toHaveLength(2);

    buttons[0].props.onClick?.();
    expect(resumed).toBe(1);
    expect(discarded).toBe(0);

    buttons[1].props.onClick?.();
    expect(resumed).toBe(1);
    expect(discarded).toBe(1);
  });
});
