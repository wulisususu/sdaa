import { describe, expect, test } from "vitest";
import type { ClarificationQuestion } from "./question";
import {
  canVisitStage,
  countAnsweredClarifications,
  getPreviousStage,
  getStageIndex,
  isRawQuestionReady,
  setClarificationAnswer
} from "./session";

describe("question compiler session rules", () => {
  test("raw question needs at least five non-whitespace characters", () => {
    expect(isRawQuestionReady("   ")).toBe(false);
    expect(isRawQuestionReady("四个字啊")).toBe(true);
    expect(isRawQuestionReady("  现在转码还有前途吗？  ")).toBe(true);
  });

  test("previous stage stops at input", () => {
    expect(getPreviousStage("input")).toBe("input");
    expect(getPreviousStage("clarify")).toBe("input");
    expect(getPreviousStage("coverage")).toBe("diagnose");
  });

  test("stage index follows the product flow", () => {
    expect(getStageIndex("input")).toBe(0);
    expect(getStageIndex("result")).toBe(4);
  });

  test("cannot jump beyond the furthest visited stage", () => {
    expect(canVisitStage("input", "clarify")).toBe(true);
    expect(canVisitStage("clarify", "clarify")).toBe(true);
    expect(canVisitStage("diagnose", "clarify")).toBe(false);
  });
});

describe("clarification answers", () => {
  const questions: ClarificationQuestion[] = [
    { id: "background", question: "你的背景？", options: ["学生", "工作"] },
    { id: "goal", question: "你最关心？", options: ["就业", "薪资"] }
  ];

  test("sets one answer per clarification without mutating previous answers", () => {
    const previous = { background: "学生" };
    const next = setClarificationAnswer(previous, "background", "工作");

    expect(previous).toEqual({ background: "学生" });
    expect(next).toEqual({ background: "工作" });
  });

  test("answered count ignores unknown question ids", () => {
    const answers = { background: "学生", unknown: "ignored" };
    expect(countAnsweredClarifications(questions, answers)).toBe(1);
  });
});
