import { QuestionAnalysisSchema, type QuestionAnalysis } from "@ask-better/domain";
import type { ZodType } from "zod";
import { generateStructured as defaultGenerateStructured, LLMProviderError } from "../ai/provider";
import { ANALYZE_SYSTEM_PROMPT, buildAnalyzePrompt } from "../ai/prompts/analyze";

export type StructuredGenerator = <T>(
  schema: ZodType<T>,
  system: string,
  prompt: string
) => Promise<T>;

export interface AnalyzeQuestionDependencies {
  generateStructured?: StructuredGenerator;
}

export async function analyzeQuestion(
  rawQuestion: string,
  deps: AnalyzeQuestionDependencies = {}
): Promise<QuestionAnalysis> {
  const generate = deps.generateStructured ?? defaultGenerateStructured;
  const generated = await generate(
    QuestionAnalysisSchema,
    ANALYZE_SYSTEM_PROMPT,
    buildAnalyzePrompt(rawQuestion)
  );

  const parsed = QuestionAnalysisSchema.safeParse(generated);
  if (!parsed.success) {
    throw new LLMProviderError(
      "AI_INVALID_OUTPUT",
      "AI 返回的问题分析结构无法校验，请重试。",
      true,
      { cause: parsed.error }
    );
  }

  return parsed.data;
}
