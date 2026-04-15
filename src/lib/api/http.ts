import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

const REQUEST_ID_HEADER = "x-request-id";
const CORRELATION_ID_HEADER = "x-correlation-id";

export function getOrCreateRequestId(req: Request): string {
  const fromHeader = req.headers.get(REQUEST_ID_HEADER)?.trim();
  if (fromHeader) return fromHeader;
  return randomUUID();
}

export function getOrCreateCorrelationId(req: Request, requestId?: string): string {
  const fromHeader = req.headers.get(CORRELATION_ID_HEADER)?.trim();
  if (fromHeader) return fromHeader;
  return requestId ?? getOrCreateRequestId(req);
}

function withRequestId(
  res: NextResponse,
  requestId: string,
): NextResponse {
  res.headers.set(REQUEST_ID_HEADER, requestId);
  return res;
}

function withCorrelationId(
  res: NextResponse,
  correlationId: string,
): NextResponse {
  res.headers.set(CORRELATION_ID_HEADER, correlationId);
  return res;
}

export function applyRequestTracingHeaders(
  res: NextResponse,
  meta: { requestId: string; correlationId?: string },
): NextResponse {
  const withRequest = withRequestId(res, meta.requestId);
  return withCorrelationId(
    withRequest,
    meta.correlationId?.trim() || meta.requestId,
  );
}

export function jsonSuccess<T extends Record<string, unknown>>(
  requestId: string,
  data: T,
  init?: ResponseInit,
): NextResponse {
  return applyRequestTracingHeaders(
    NextResponse.json({ ok: true, ...data }, init),
    {
      requestId,
      correlationId: requestId,
    },
  );
}

export function jsonError(
  requestId: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return applyRequestTracingHeaders(
    NextResponse.json({ ok: false, error: message, ...extra }, { status }),
    {
      requestId,
      correlationId: requestId,
    },
  );
}
