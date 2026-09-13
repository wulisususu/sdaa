import type { CompiledQuestion, PublishableQuestion } from "@ask-better/domain";

export type PublicationQualityCode =
  | "META_VOICE"
  | "NUMERIC_DRIFT"
  | "DUPLICATE_QUESTION"
  | "SCOPE_EXPLOSION";

export interface PublicationQualityViolation {
  code: PublicationQualityCode;
  message: string;
}

const FORBIDDEN_META_PHRASES = [
  "用户是",
  "用户希望",
  "用户没有提供",
  "用户未提供",
  "背景：",
  "目标：",
  "限制：",
  "真正困惑：",
  "希望回答重点："
] as const;

const UNIT = "小时|天|周|个月|月|年|元|万元|%|岁|公里|km|分钟";
const NUMERIC_FACT_RE = new RegExp(`\\d+(?:\\.\\d+)?\\s*(?:${UNIT})`, "giu");
const NUMERIC_RANGE_RE = new RegExp(
  `(\\d+(?:\\.\\d+)?)\\s*(?:-|–|—|~|～|至|到)\\s*(\\d+(?:\\.\\d+)?)\\s*(${UNIT})`,
  "giu"
);

function normalizeNumericFact(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function extractNumericFacts(value: string): Set<string> {
  const facts = new Set(
    Array.from(value.matchAll(NUMERIC_FACT_RE), (match) => normalizeNumericFact(match[0]))
  );

  for (const match of value.matchAll(NUMERIC_RANGE_RE)) {
    const [, start, end, unit] = match;
    facts.add(normalizeNumericFact(`${start}${unit}`));
    facts.add(normalizeNumericFact(`${end}${unit}`));
  }

  return facts;
}

function normalizeQuestion(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\s，。！？、；：,.!?;:（）()【】\[\]“”"'‘’]/g, "");
}

function hasDuplicateQuestion(questions: string[]): boolean {
  const normalized = questions.map(normalizeQuestion).filter(Boolean);
  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const a = normalized[i];
      const b = normalized[j];
      if (a === b) return true;
      const shorter = a.length <= b.length ? a : b;
      const longer = a.length > b.length ? a : b;
      if (shorter.length >= 8 && longer.includes(shorter) && longer.length / shorter.length <= 1.5) {
        return true;
      }
    }
  }
  return false;
}

function compiledQuestionText(question: CompiledQuestion): string {
  return [
    question.title,
    question.background,
    question.goal,
    ...question.constraints,
    question.coreUncertainty,
    ...question.expectedAnswer
  ].join("\n");
}

export function validatePublicationQuality(input: {
  rawQuestion: string;
  clarificationAnswers: Record<string, string>;
  compiledQuestion: CompiledQuestion;
  publishableQuestion: PublishableQuestion;
}): PublicationQualityViolation[] {
  const violations: PublicationQualityViolation[] = [];
  const publishableText = [
    input.publishableQuestion.title,
    input.publishableQuestion.context,
    ...input.publishableQuestion.questions
  ].join("\n");

  const metaPhrase = FORBIDDEN_META_PHRASES.find((phrase) => publishableText.includes(phrase));
  if (metaPhrase) {
    violations.push({
      code: "META_VOICE",
      message: `最终发布稿包含编译器内部表达“${metaPhrase}”，应改成自然的人类提问语气。`
    });
  }

  const userFactsText = [input.rawQuestion, ...Object.values(input.clarificationAnswers)].join("\n");
  const allowedNumericFacts = extractNumericFacts(userFactsText);
  const generatedNumericFacts = extractNumericFacts(
    `${publishableText}\n${compiledQuestionText(input.compiledQuestion)}`
  );
  const novelNumericFacts = [...generatedNumericFacts].filter((fact) => !allowedNumericFacts.has(fact));
  if (novelNumericFacts.length > 0) {
    violations.push({
      code: "NUMERIC_DRIFT",
      message: `编译结果引入了用户未明确提供的数字约束：${novelNumericFacts.join("、")}。`
    });
  }

  if (input.publishableQuestion.questions.length > 4) {
    violations.push({
      code: "SCOPE_EXPLOSION",
      message: "最终发布稿的子问题超过 4 个，应收敛到最直接帮助回答核心困惑的 2–3 个。"
    });
  }

  if (hasDuplicateQuestion(input.publishableQuestion.questions)) {
    violations.push({
      code: "DUPLICATE_QUESTION",
      message: "最终发布稿包含重复或高度重合的子问题，应合并。"
    });
  }

  return violations;
}
