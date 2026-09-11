import { describe, expect, it } from "vitest";
import { getNextStage, stageLabels } from "./question";

describe("Question Compiler stages", () => {
  it("moves through the user-facing stages in order", () => {
    expect(getNextStage("input")).toBe("clarify");
    expect(getNextStage("clarify")).toBe("diagnose");
    expect(getNextStage("diagnose")).toBe("coverage");
    expect(getNextStage("coverage")).toBe("result");
    expect(getNextStage("result")).toBe("result");
  });

  it("uses Chinese as the primary stage labels", () => {
    expect(stageLabels).toEqual({
      input: "输入问题",
      clarify: "补充信息",
      diagnose: "问题体检",
      coverage: "已有讨论",
      result: "编译结果"
    });
  });
});
