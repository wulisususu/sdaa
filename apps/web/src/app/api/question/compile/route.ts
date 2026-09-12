import { CompileRequestSchema } from "@ask-better/domain";
import { apiErrorResponse, toSafeApiResponse } from "../../../../lib/http-errors";
import { compileQuestion } from "../../../../lib/question/compile-service";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorResponse("VALIDATION_ERROR", false);
  }

  const parsed = CompileRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse("VALIDATION_ERROR", false);
  }

  try {
    const data = await compileQuestion(parsed.data);
    return Response.json({ ok: true, data });
  } catch (error) {
    return toSafeApiResponse(error, "COMPILE_FAILED");
  }
}
