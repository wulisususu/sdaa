import { RetrieveRequestSchema } from "@ask-better/domain";
import { apiErrorResponse, toSafeApiResponse } from "../../../../lib/http-errors";
import { retrieveQuestion } from "../../../../lib/question/retrieve-service";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorResponse("VALIDATION_ERROR", false);
  }

  const parsed = RetrieveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse("VALIDATION_ERROR", false);
  }

  try {
    const data = await retrieveQuestion(parsed.data);
    return Response.json({ ok: true, data });
  } catch (error) {
    return toSafeApiResponse(error, "ZHIHU_UPSTREAM_ERROR");
  }
}
