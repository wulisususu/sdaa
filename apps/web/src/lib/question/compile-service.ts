import {
  CompileArtifactSchema,
  CompileResultSchema,
  type CompileArtifact,
  type CompileRequest,
  type CompileResult
} from "@ask-better/domain";
import { generateStructured as defaultGenerateStructured, LLMProviderError } from "../ai/provider";
import {
  COMPILE_SYSTEM_PROMPT,
  buildCompilePrompt,
  buildCompileRepairPrompt,
  type CompilePromptContext
} from "../ai/prompts/compile";
import type { StructuredGenerator } from "./analyze-service";
import { validatePublicationQuality } from "./publication-quality";
import {
  auditSemanticGrounding as defaultAuditSemanticGrounding,
  describeSemanticViolations,
  type SemanticAuditInput,
  type SemanticAuditor
} from "./semantic-grounding";

export interface CompileQuestionDependencies {
  generateStructured?: StructuredGenerator;
  auditSemanticGrounding?: SemanticAuditor;
}

function buildCompileContext(input: CompileRequest): CompilePromptContext {
  const questionById = new Map(
    input.analysis.clarificationQuestions.map((question) => [question.id, question.question])
  );

  return {
    user: {
      rawQuestion: input.rawQuestion,
      clarifications: Object.entries(input.clarificationAnswers).map(([id, answer]) => ({
        id,
        question: questionById.get(id) ?? id,
        answer
      }))
    },
    intent: {
      intent: input.analysis.intent,
      primaryGoal: input.analysis.primaryGoal
    },
    knowledge: {
      existingCoverage: input.retrieval?.existingCoverage ?? [],
      knowledgeGaps: input.retrieval?.knowledgeGaps ?? [],
      evidenceRefs: (input.retrieval?.evidence ?? [])
        .slice(0, 6)
        .map(({ id, title }) => ({ id, title }))
    }
  };
}

/**
 * 审计器输入面刻意收窄：只给用户真正回答过的澄清，不给 missingContext / diagnostics /
 * 未回答澄清 / Evidence 正文与评论。
 */
function buildSemanticAuditInput(input: CompileRequest, artifact: CompileArtifact): SemanticAuditInput {
  const questionById = new Map(
    input.analysis.clarificationQuestions.map((question) => [question.id, question.question])
  );

  return {
    rawQuestion: input.rawQuestion,
    answeredClarifications: Object.entries(input.clarificationAnswers).map(([id, answer]) => ({
      question: questionById.get(id) ?? id,
      answer
    })),
    coreUncertainty: artifact.compiledQuestion.coreUncertainty,
    knowledgeGaps: (input.retrieval?.knowledgeGaps ?? []).map(({ id, title, detail }) => ({
      id,
      title,
      detail
    })),
    publishableQuestion: artifact.publishableQuestion
  };
}

function parseArtifact(value: unknown): CompileArtifact {
  const parsed = CompileArtifactSchema.safeParse(value);
  if (!parsed.success) {
    throw new LLMProviderError(
      "COMPILE_FAILED",
      "问题编译结果无法校验，请重试。",
      true,
      { cause: parsed.error }
    );
  }
  return parsed.data;
}

function qualityMessages(input: CompileRequest, artifact: CompileArtifact): string[] {
  return validatePublicationQuality({
    rawQuestion: input.rawQuestion,
    clarificationAnswers: input.clarificationAnswers,
    compiledQuestion: artifact.compiledQuestion,
    publishableQuestion: artifact.publishableQuestion
  }).map((item) => item.message);
}

function finalize(input: CompileRequest, artifact: CompileArtifact): CompileResult {
  return CompileResultSchema.parse({
    ...artifact,
    evidenceUsed: Boolean(input.retrieval?.evidence.length),
    ...(
      input.retrieval && input.retrieval.status !== "success"
        ? { warnings: ["本次知乎检索并非完整成功，编译结果已保留这一证据边界。"] }
        : {}
    )
  });
}

function publicationFailed(): LLMProviderError {
  return new LLMProviderError(
    "COMPILE_FAILED",
    "问题编译结果未通过发布质量检查，请重试。",
    true
  );
}

/**
 * 发布质量门：确定性守卫（无 LLM）→ 语义扎根审计（LLM）。
 *
 * LLM 预算：正常路径 2 次（compile + audit）；修复路径最多 4 次
 * （compile + audit + repair + re-audit），修复后仍不合格直接 COMPILE_FAILED，绝不循环。
 * 确定性守卫已经失败时跳过审计——此时必然要 repair，多跑一次审计只会浪费额度。
 */
export async function compileQuestion(
  input: CompileRequest,
  deps: CompileQuestionDependencies = {}
): Promise<CompileResult> {
  const generate = deps.generateStructured ?? defaultGenerateStructured;
  const audit = deps.auditSemanticGrounding ?? defaultAuditSemanticGrounding;
  const context = buildCompileContext(input);

  const firstGenerated = await generate(
    CompileArtifactSchema,
    COMPILE_SYSTEM_PROMPT,
    buildCompilePrompt(context)
  );
  let artifact = parseArtifact(firstGenerated);
  const deterministicViolations = qualityMessages(input, artifact);

  if (deterministicViolations.length === 0) {
    const auditResult = await audit(buildSemanticAuditInput(input, artifact));
    if (auditResult.passed) {
      return finalize(input, artifact);
    }

    const repaired = await generate(
      CompileArtifactSchema,
      COMPILE_SYSTEM_PROMPT,
      buildCompileRepairPrompt({
        context,
        previousArtifact: artifact,
        violations: describeSemanticViolations(auditResult.violations)
      })
    );
    artifact = parseArtifact(repaired);

    if (qualityMessages(input, artifact).length > 0) {
      throw publicationFailed();
    }
    const reaudit = await audit(buildSemanticAuditInput(input, artifact));
    if (!reaudit.passed) {
      throw publicationFailed();
    }

    return finalize(input, artifact);
  }

  const repaired = await generate(
    CompileArtifactSchema,
    COMPILE_SYSTEM_PROMPT,
    buildCompileRepairPrompt({
      context,
      previousArtifact: artifact,
      violations: deterministicViolations
    })
  );
  artifact = parseArtifact(repaired);

  if (qualityMessages(input, artifact).length > 0) {
    throw publicationFailed();
  }
  const reaudit = await audit(buildSemanticAuditInput(input, artifact));
  if (!reaudit.passed) {
    throw publicationFailed();
  }

  return finalize(input, artifact);
}
