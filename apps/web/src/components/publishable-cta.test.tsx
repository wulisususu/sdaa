import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CompiledQuestionPanel } from "./compiled-question-panel";
import { ResultStage } from "./result-stage";

const question = {
  title: "新一线城市大一学生四项基础生活费标准",
  background: "孩子大一，在新一线城市上学。",
  goal: "确定只覆盖四项的月度基础生活费。",
  constraints: ["只覆盖吃饭、交通、通讯、日用品"],
  coreUncertainty: "只算四项时，新一线城市大一学生每月基础生活费应定为多少。",
  expectedAnswer: ["四项合计金额区间", "四项各自的大致水平"]
};

const publishableQuestion = {
  title: "新一线城市大一学生，只算四项，每月生活费给多少合适？",
  context: "孩子今年读大一，学校在新一线城市。通讯费用另行承担，不计入这笔生活费。",
  questions: ["四项合计每月大概在什么区间比较合适？", "吃饭、交通、日用品分别大概按多少估算？"]
};

describe("publishable CTA", () => {
  test("points at a verified destination instead of the removed ask deep link", () => {
    const html = renderToStaticMarkup(
      <CompiledQuestionPanel question={question} publishableQuestion={publishableQuestion} />
    );

    expect(html).toContain("前往知乎");
    expect(html).toContain("复制知乎版问题");
    expect(html).toContain("复制后前往知乎发起提问");
    expect(html).not.toContain("/question/ask");
  });

  test("never claims a publishing capability that does not exist", () => {
    const html = renderToStaticMarkup(
      <CompiledQuestionPanel question={question} publishableQuestion={publishableQuestion} />
    );

    for (const forbidden of ["打开知乎提问页", "一键发布", "直接发布", "已发布"]) {
      expect(html).not.toContain(forbidden);
    }
  });

  test("keeps the copy action as the primary CTA and hides the IR by default", () => {
    const html = renderToStaticMarkup(
      <CompiledQuestionPanel question={question} publishableQuestion={publishableQuestion} />
    );

    expect(html).toContain("复制知乎版问题");
    expect(html).toMatch(/<details[^>]*class="compiler-details"(?![^>]*\bopen\b)/);
    expect(html).toContain("Question IR");
  });

  test("result exposes before, after, and action motion hooks", () => {
    const html = renderToStaticMarkup(
      <ResultStage
        rawQuestion="原始问题"
        question={question}
        publishableQuestion={publishableQuestion}
        evidenceUsed={false}
        copyStatus="idle"
        onCopy={() => undefined}
        onReoptimize={() => undefined}
        onNewQuestion={() => undefined}
        onOpenZhihu={() => undefined}
      />
    );

    expect(html).toContain('data-motion="before"');
    expect(html).toContain('data-motion="after"');
    expect(html).toContain('data-motion="result-actions"');
  });

  test("compiler demo no longer opens the 404 ask route", () => {
    const source = readFileSync(new URL("./compiler-demo.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("/question/ask");
    expect(source).toContain("https://www.zhihu.com/");
  });
});
