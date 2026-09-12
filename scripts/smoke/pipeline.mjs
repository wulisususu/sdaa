async function postJson(fetchImpl, url, body) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok || payload?.ok !== true) {
    const code = payload?.error?.code ?? `HTTP_${response.status}`;
    const message = payload?.error?.message ?? "生产 Smoke Test 失败。";
    throw new Error(`${code}: ${message}`);
  }
  return payload.data;
}

function buildClarificationAnswers(analysis) {
  return Object.fromEntries(
    (analysis.clarificationQuestions ?? [])
      .filter((question) => Array.isArray(question.options) && question.options.length > 0)
      .map((question) => [question.id, question.options[0]])
  );
}

export async function runPipelineSmoke(baseUrl, rawQuestion, fetchImpl = fetch) {
  const base = baseUrl.replace(/\/$/, "");
  const analyze = await postJson(fetchImpl, `${base}/api/question/analyze`, { rawQuestion });
  const clarificationAnswers = buildClarificationAnswers(analyze);
  const retrieval = await postJson(fetchImpl, `${base}/api/question/retrieve`, {
    rawQuestion,
    analysis: analyze,
    clarificationAnswers
  });
  const compile = await postJson(fetchImpl, `${base}/api/question/compile`, {
    rawQuestion,
    analysis: analyze,
    clarificationAnswers,
    retrieval
  });
  return { analyze, clarificationAnswers, retrieval, compile };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const baseUrl = process.env.SMOKE_BASE_URL;
  const rawQuestion = process.argv.slice(2).join(" ").trim();
  if (!baseUrl || rawQuestion.length < 5) {
    console.error("Usage: SMOKE_BASE_URL=https://your-project.vercel.app pnpm smoke:production -- \"现在转码还有前途吗？\"");
    process.exit(2);
  }

  try {
    const result = await runPipelineSmoke(baseUrl, rawQuestion);
    console.log(JSON.stringify({
      question: rawQuestion,
      clarificationCount: result.analyze.clarificationQuestions?.length ?? 0,
      retrievalStatus: result.retrieval.status,
      evidenceCount: result.retrieval.evidence?.length ?? 0,
      compiledTitle: result.compile.compiledQuestion?.title,
      evidenceUsed: result.compile.evidenceUsed
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Production smoke failed");
    process.exit(1);
  }
}
