import {
  applyRequestTracingHeaders,
  getOrCreateCorrelationId,
  getOrCreateRequestId,
} from "@/lib/api/http";
import { NextResponse } from "next/server";

export type RequestContext = {
  requestId: string;
  correlationId: string;
};

export function getRequestContext(req: Request): RequestContext {
  const requestId = getOrCreateRequestId(req);
  const correlationId = getOrCreateCorrelationId(req, requestId);
  return { requestId, correlationId };
}

export function withRequestContextHeaders(
  response: NextResponse,
  ctx: RequestContext,
): NextResponse {
  return applyRequestTracingHeaders(response, ctx);
}

