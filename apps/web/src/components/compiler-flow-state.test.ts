import { describe, expect, test } from "vitest";
import { capVisitedStageAfterAnswer } from "./compiler-demo";

describe("compiler flow state", () => {
  test("answering during first clarification does not mark diagnose as visited", () => {
    expect(capVisitedStageAfterAnswer("clarify")).toBe("clarify");
  });

  test("editing an answer after downstream work invalidates coverage and result", () => {
    expect(capVisitedStageAfterAnswer("coverage")).toBe("diagnose");
    expect(capVisitedStageAfterAnswer("result")).toBe("diagnose");
  });
});
