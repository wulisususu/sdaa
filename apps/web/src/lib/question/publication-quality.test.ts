import { describe, expect, test } from "vitest";
import type { CompiledQuestion, PublishableQuestion } from "@ask-better/domain";
import { validatePublicationQuality } from "./publication-quality";

function baseQuestion(overrides: Partial<PublishableQuestion> = {}): PublishableQuestion {
  return {
    title: "每天最多投入 3 小时时，AI 应用开发应该怎么学？",
    context: "我想系统学习 AI 应用开发，但每天最多只能投入 3 小时，希望得到一个现实的学习路径。",
    questions: ["应该先学哪些基础？", "每个阶段达到什么程度再进入下一步？"],
    ...overrides
  };
}

function baseCompiled(overrides: Partial<CompiledQuestion> = {}): CompiledQuestion {
  return {
    title: "AI 应用开发应该如何安排学习路径？",
    background: "正在规划 AI 应用开发学习路线。",
    goal: "形成可执行的学习路径。",
    constraints: [],
    coreUncertainty: "应该按照什么顺序学习？",
    expectedAnswer: ["学习顺序", "阶段标准"],
    ...overrides
  };
}

describe("validatePublicationQuality", () => {
  test("accepts a concise human-facing question that preserves user constraints", () => {
    const violations = validatePublicationQuality({
      rawQuestion: "每天最多 3 小时，AI 应用开发应该怎么学？",
      clarificationAnswers: { goal: "求职" },
      compiledQuestion: baseCompiled({ constraints: ["每天最多 3 小时"] }),
      publishableQuestion: baseQuestion()
    });
    expect(violations).toEqual([]);
  });

  test("rejects compiler meta voice", () => {
    const violations = validatePublicationQuality({
      rawQuestion: "孩子上大学一个月生活费多少合适？",
      clarificationAnswers: {},
      compiledQuestion: baseCompiled(),
      publishableQuestion: baseQuestion({
        title: "孩子上大学每月生活费给多少比较合适？",
        context: "用户是家长，用户未提供孩子的性别和学校住宿条件，希望判断生活费额度。",
        questions: ["每月给多少比较合适？"]
      })
    });
    expect(violations.some((item) => item.code === "META_VOICE")).toBe(true);
  });

  test("rejects a novel numeric constraint such as changing 3 hours into 5 hours", () => {
    const violations = validatePublicationQuality({
      rawQuestion: "每天最多 3 小时，AI 应用开发应该怎么学？",
      clarificationAnswers: {},
      compiledQuestion: baseCompiled({ constraints: ["每天最多 3 小时"] }),
      publishableQuestion: baseQuestion({
        context: "我想系统学习 AI 应用开发，每天可以投入不到 5 小时，希望得到现实的学习路径。"
      })
    });
    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "NUMERIC_DRIFT" })
    ]));
  });

  test("also rejects numeric drift hidden only in the internal IR", () => {
    const violations = validatePublicationQuality({
      rawQuestion: "每天最多 3 小时，AI 应用开发应该怎么学？",
      clarificationAnswers: {},
      compiledQuestion: baseCompiled({ constraints: ["每天最多 5 小时"] }),
      publishableQuestion: baseQuestion()
    });
    expect(violations.some((item) => item.code === "NUMERIC_DRIFT")).toBe(true);
  });

  test("allows numeric facts explicitly supplied through clarification answers", () => {
    const violations = validatePublicationQuality({
      rawQuestion: "AI 应用开发应该怎么学？",
      clarificationAnswers: { time: "每天最多 3 小时" },
      compiledQuestion: baseCompiled({ constraints: ["每天最多 3 小时"] }),
      publishableQuestion: baseQuestion()
    });
    expect(violations.some((item) => item.code === "NUMERIC_DRIFT")).toBe(false);
  });

  test("preserves both endpoints of an explicit numeric range", () => {
    const violations = validatePublicationQuality({
      rawQuestion: "每天能投入 2-3 小时，AI 应用开发应该怎么学？",
      clarificationAnswers: {},
      compiledQuestion: baseCompiled({ constraints: ["每天投入 2 小时到 3 小时"] }),
      publishableQuestion: baseQuestion({
        title: "每天投入 2 到 3 小时时，AI 应用开发应该怎么学？",
        context: "我想系统学习 AI 应用开发，每天能投入 2 小时到 3 小时，希望得到现实的学习路径。"
      })
    });
    expect(violations.some((item) => item.code === "NUMERIC_DRIFT")).toBe(false);
  });

  test("rejects normalized duplicate subquestions", () => {
    const violations = validatePublicationQuality({
      rawQuestion: "AI 应用开发应该怎么学？",
      clarificationAnswers: {},
      compiledQuestion: baseCompiled(),
      publishableQuestion: baseQuestion({
        title: "AI 应用开发应该怎么系统学习比较合理？",
        context: "我想系统学习 AI 应用开发，希望得到一条清晰、可执行的学习路线。",
        questions: ["应该先学哪些基础？", "应该先学哪些基础"]
      })
    });
    expect(violations.some((item) => item.code === "DUPLICATE_QUESTION")).toBe(true);
  });
});
