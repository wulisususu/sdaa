import { z } from "zod";

export const DiagnosticLevelSchema = z.enum(["info", "warning", "high"]);

export const ClarificationQuestionSchema = z.object({
  id: z.string().trim().min(1),
  question: z.string().trim().min(1),
  helper: z.string().trim().min(1).optional(),
  options: z.array(z.string().trim().min(1)).min(2).max(6)
});

export const LintIssueSchema = z.object({
  code: z.string().trim().regex(/^W\d{3}$/),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  level: DiagnosticLevelSchema
});

export const MissingContextSchema = z.object({
  field: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  priority: z.number().int().min(1).max(3)
});

export const AnalyzeRequestSchema = z.object({
  rawQuestion: z.string().trim().min(5).max(1000)
});

export const QuestionAnalysisSchema = z
  .object({
    intent: z.array(z.string().trim().min(1)).min(1).max(5),
    primaryGoal: z.string().trim().min(1),
    timeSensitive: z.boolean(),
    ambiguities: z.array(z.string().trim().min(1)).max(6),
    missingContext: z.array(MissingContextSchema).max(6),
    clarificationQuestions: z.array(ClarificationQuestionSchema).max(4),
    diagnostics: z.array(LintIssueSchema).max(5)
  })
  .superRefine((value, ctx) => {
    const needsClarification = value.ambiguities.length > 0 || value.missingContext.length > 0;
    if (needsClarification && value.clarificationQuestions.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["clarificationQuestions"],
        message: "Clarification requires between two and four questions."
      });
    }
  });

export const SearchEvidenceItemSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  summary: z.string(),
  url: z.string().url(),
  author: z.string(),
  editedAt: z.number().int().nonnegative(),
  rankingScore: z.number(),
  authorityLevel: z.string(),
  voteUpCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  selectedComments: z.array(z.string()),
  source: z.literal("zhihu")
});

export const KnowledgeCoverageItemSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  detail: z.string().trim().min(1),
  strength: z.enum(["high", "medium", "low"]),
  evidenceIds: z.array(z.string().trim().min(1)).optional()
});

export const KnowledgeGapItemSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  detail: z.string().trim().min(1),
  evidenceIds: z.array(z.string().trim().min(1)).optional()
});

export const CompiledQuestionSchema = z.object({
  title: z.string().trim().min(1),
  background: z.string().trim().min(1),
  goal: z.string().trim().min(1),
  constraints: z.array(z.string().trim().min(1)).max(8),
  coreUncertainty: z.string().trim().min(1),
  expectedAnswer: z.array(z.string().trim().min(1)).min(2).max(4)
});

export const PublishableQuestionSchema = z.object({
  title: z.string().trim().min(8).max(80),
  context: z.string().trim().min(20).max(500),
  questions: z.array(z.string().trim().min(4).max(120)).min(1).max(4)
});

export const CompileArtifactSchema = z.object({
  compiledQuestion: CompiledQuestionSchema,
  publishableQuestion: PublishableQuestionSchema
});

export const SearchQueryPlanSchema = z.object({
  queries: z.array(z.string().trim().min(1)).min(1).max(3)
});

export const EvidenceStatusSchema = z.enum(["sufficient", "partial", "insufficient"]);
export const RetrievalStatusSchema = z.enum(["success", "partial", "unavailable", "quota_limited"]);

export const CoverageAnalysisSchema = z.object({
  evidenceStatus: EvidenceStatusSchema,
  existingCoverage: z.array(KnowledgeCoverageItemSchema).max(8),
  knowledgeGaps: z.array(KnowledgeGapItemSchema).max(8)
});

export const ClarificationAnswersSchema = z.record(z.string(), z.string().trim().min(1));

export const RetrieveRequestSchema = z.object({
  rawQuestion: AnalyzeRequestSchema.shape.rawQuestion,
  analysis: QuestionAnalysisSchema,
  clarificationAnswers: ClarificationAnswersSchema
});

export const RetrieveResultSchema = z.object({
  status: RetrievalStatusSchema,
  evidenceStatus: EvidenceStatusSchema,
  queries: z.array(z.string().trim().min(1)).max(3),
  evidence: z.array(SearchEvidenceItemSchema).max(24),
  existingCoverage: z.array(KnowledgeCoverageItemSchema).max(8),
  knowledgeGaps: z.array(KnowledgeGapItemSchema).max(8),
  warnings: z.array(z.string().trim().min(1)).optional()
});

export const CompileRequestSchema = z.object({
  rawQuestion: AnalyzeRequestSchema.shape.rawQuestion,
  analysis: QuestionAnalysisSchema,
  clarificationAnswers: ClarificationAnswersSchema,
  retrieval: RetrieveResultSchema.optional()
});

export const CompileResultSchema = z.object({
  compiledQuestion: CompiledQuestionSchema,
  publishableQuestion: PublishableQuestionSchema,
  evidenceUsed: z.boolean(),
  warnings: z.array(z.string().trim().min(1)).optional()
});

export const ApiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "AI_NOT_CONFIGURED",
  "AI_TIMEOUT",
  "AI_INVALID_OUTPUT",
  "ZHIHU_NOT_CONFIGURED",
  "ZHIHU_UNAUTHORIZED",
  "ZHIHU_RATE_LIMITED",
  "ZHIHU_UPSTREAM_ERROR",
  "COMPILE_FAILED"
]);

export const ApiErrorSchema = z.object({
  code: ApiErrorCodeSchema,
  message: z.string().trim().min(1),
  retryable: z.boolean()
});

export type QuestionAnalysis = z.infer<typeof QuestionAnalysisSchema>;
export type SearchEvidenceItem = z.infer<typeof SearchEvidenceItemSchema>;
export type RetrieveRequest = z.infer<typeof RetrieveRequestSchema>;
export type RetrieveResult = z.infer<typeof RetrieveResultSchema>;
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;
export type RetrievalStatus = z.infer<typeof RetrievalStatusSchema>;
export type CompiledQuestion = z.infer<typeof CompiledQuestionSchema>;
export type PublishableQuestion = z.infer<typeof PublishableQuestionSchema>;
export type CompileArtifact = z.infer<typeof CompileArtifactSchema>;
export type CompileRequest = z.infer<typeof CompileRequestSchema>;
export type CompileResult = z.infer<typeof CompileResultSchema>;
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
