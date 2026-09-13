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

export interface CompileQuestionDependencies {
  generateStructured?: StructuredGenerator;
}

function buildCompileContext(input: CompileRequest): CompilePromptContext {
  return {
    user: {
      rawQuestion: input.rawQuestion,
      clarificationAnswers: input.clarificationAnswers
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
    publishableQuestion: artifact.publishableQuestion
  }).map((item) => item.message);
}

export async function compileQuestion(
  input: CompileRequest,
  deps: CompileQuestionDependencies = {}
): Promise<CompileResult> {
  const generate = deps.generateStructured ?? defaultGenerateStructured;
  const context = buildCompileContext(input);

  const firstGenerated = await generate(
    CompileArtifactSchema,
    COMPILE_SYSTEM_PROMPT,
    buildCompilePrompt(context)
  );
  let artifact = parseArtifact(firstGenerated);
  let violations = qualityMessages(input, artifact);

  if (violations.length > 0) {
    const repaired = await generate(
      CompileArtifactSchema,
      COMPILE_SYSTEM_PROMPT,
      buildCompileRepairPrompt({
        context,
        previousArtifact: artifact,
        violations
      })
    );
    artifact = parseArtifact(repaired);
    violations = qualityMessages(input, artifact);

    if (violations.length > 0) {
      throw new LLMProviderError(
        "COMPILE_FAILED",
        "问题编译结果未通过发布质量检查，请重试。",
        true
      );
    }
  }

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
