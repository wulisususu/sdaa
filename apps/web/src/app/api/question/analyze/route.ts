import { AnalyzeRequestSchema } from "@ask-better/domain";
import { apiErrorResponse, toSafeApiResponse } from "../../../../lib/http-errors";
import { analyzeQuestion } from "../../../../lib/question/analyze-service";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorResponse("VALIDATION_ERROR", false);
  }

  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse("VALIDATION_ERROR", false);
  }

  try {
    const data = await analyzeQuestion(parsed.data.rawQuestion);
    return Response.json({ ok: true, data });
  } catch (error) {
    return toSafeApiResponse(error, "AI_INVALID_OUTPUT");
  }
}
