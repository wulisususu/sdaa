import {
  CompiledQuestionSchema,
  CompileResultSchema,
  type CompileRequest,
  type CompileResult
} from "@ask-better/domain";
import { generateStructured as defaultGenerateStructured, LLMProviderError } from "../ai/provider";
import { COMPILE_SYSTEM_PROMPT, buildCompilePrompt } from "../ai/prompts/compile";
import type { StructuredGenerator } from "./analyze-service";

export interface CompileQuestionDependencies {
  generateStructured?: StructuredGenerator;
}

export async function compileQuestion(
  input: CompileRequest,
  deps: CompileQuestionDependencies = {}
): Promise<CompileResult> {
  const generate = deps.generateStructured ?? defaultGenerateStructured;

  const generated = await generate(
    CompiledQuestionSchema,
    COMPILE_SYSTEM_PROMPT,
    buildCompilePrompt({
      rawQuestion: input.rawQuestion,
      clarificationAnswers: input.clarificationAnswers,
      analysis: input.analysis,
      retrieval: input.retrieval
    })
  );

  const parsed = CompiledQuestionSchema.safeParse(generated);
  if (!parsed.success) {
    throw new LLMProviderError(
      "COMPILE_FAILED",
      "问题编译结果无法校验，请重试。",
      true,
      { cause: parsed.error }
    );
  }

  return CompileResultSchema.parse({
    compiledQuestion: parsed.data,
    evidenceUsed: Boolean(input.retrieval?.evidence.length),
    ...(
      input.retrieval && input.retrieval.status !== "success"
        ? { warnings: ["本次知乎检索并非完整成功，编译结果已保留这一证据边界。"] }
        : {}
    )
  });
}
