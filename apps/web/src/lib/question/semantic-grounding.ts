import { z } from "zod";
import { SEMANTIC_AUDIT_SYSTEM_PROMPT, buildSemanticAuditPrompt, type SemanticAuditPromptInput } from "../ai/prompts/semantic-audit";
import { LLMProviderError, generateStructured as defaultGenerateStructured } from "../ai/provider";
import type { StructuredGenerator } from "./analyze-service";

export const SemanticViolationCodeSchema = z.enum([
  "UNSUPPORTED_FACT",
  "MECHANISM_INFERENCE",
  "ADJACENT_SCOPE",
  "INTENT_DRIFT"
]);

export const SemanticViolationTargetSchema = z.enum(["title", "context", "question"]);

export const SemanticViolationSchema = z
  .object({
    code: SemanticViolationCodeSchema,
    target: SemanticViolationTargetSchema,
    questionIndex: z.number().int().min(0).max(3).optional(),
    excerpt: z.string().trim().min(1),
    reason: z.string().trim().min(1)
  })
  .superRefine((value, ctx) => {
    if (value.target === "question" && value.questionIndex === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["questionIndex"],
        message: "target=question 时必须提供 questionIndex。"
      });
    }
    if (value.target !== "question" && value.questionIndex !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["questionIndex"],
        message: "只有 target=question 时允许提供 questionIndex。"
      });
    }
  });

export const SemanticAuditSchema = z
  .object({
    passed: z.boolean(),
    violations: z.array(SemanticViolationSchema).max(8)
  })
  .superRefine((value, ctx) => {
    if (value.passed && value.violations.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["violations"],
        message: "passed=true 时 violations 必须为空。"
      });
    }
    if (!value.passed && value.violations.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["violations"],
        message: "passed=false 时 violations 必须非空。"
      });
    }
  });

/**
 * 审计器只被允许看到“用户真正说过什么”和最小必要的编译器假设/知识提示。
 * missingContext / diagnostics / 未回答澄清 / Evidence 正文与评论刻意不在此结构中。
 */
export type SemanticAuditInput = SemanticAuditPromptInput;

export type SemanticAuditViolation = z.infer<typeof SemanticViolationSchema>;
export type SemanticAuditResult = z.infer<typeof SemanticAuditSchema>;
export type SemanticAuditor = (input: SemanticAuditInput) => Promise<SemanticAuditResult>;

export function describeSemanticViolations(violations: SemanticAuditViolation[]): string[] {
  return violations.map((violation) => {
    const where = violation.target === "question"
      ? `子问题 #${(violation.questionIndex ?? 0) + 1}`
      : violation.target === "title"
        ? "标题"
        : "正文";
    return `[${violation.code}] ${where}「${violation.excerpt}」：${violation.reason}`;
  });
}

function compileFailed(message: string, cause?: unknown): LLMProviderError {
  return new LLMProviderError("COMPILE_FAILED", message, true, {
    cause: cause instanceof Error ? cause : undefined
  });
}

function validateViolationReferences(input: SemanticAuditInput, result: SemanticAuditResult): void {
  for (const violation of result.violations) {
    let targetText: string | undefined;

    if (violation.target === "title") {
      targetText = input.publishableQuestion.title;
    } else if (violation.target === "context") {
      targetText = input.publishableQuestion.context;
    } else {
      const index = violation.questionIndex;
      if (index === undefined || index >= input.publishableQuestion.questions.length) {
        throw compileFailed(
          "语义审计引用无法校验，请重试。",
          new Error("questionIndex 超出 publishableQuestion.questions 范围。")
        );
      }
      targetText = input.publishableQuestion.questions[index];
    }

    if (!targetText.includes(violation.excerpt)) {
      throw compileFailed(
        "语义审计引用无法校验，请重试。",
        new Error(`excerpt 未出现在声明的 ${violation.target} 目标中。`)
      );
    }
  }
}

export async function auditSemanticGrounding(
  input: SemanticAuditInput,
  deps: { generateStructured?: StructuredGenerator } = {}
): Promise<SemanticAuditResult> {
  const generate = deps.generateStructured ?? defaultGenerateStructured;

  let raw: unknown;
  try {
    raw = await generate(SemanticAuditSchema, SEMANTIC_AUDIT_SYSTEM_PROMPT, buildSemanticAuditPrompt(input));
  } catch (error) {
    if (error instanceof LLMProviderError) {
      if (error.code === "AI_INVALID_OUTPUT") {
        throw compileFailed("语义审计结果无法校验，请重试。", error);
      }
      throw error;
    }
    throw compileFailed("语义审计暂时失败，请重试。", error);
  }

  const parsed = SemanticAuditSchema.safeParse(raw);
  if (!parsed.success) {
    throw compileFailed("语义审计结果无法校验，请重试。", parsed.error);
  }

  validateViolationReferences(input, parsed.data);
  return parsed.data;
}
