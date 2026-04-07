import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

const REQUEST_ID_HEADER = "x-request-id";

export function getOrCreateRequestId(req: Request): string {
  const fromHeader = req.headers.get(REQUEST_ID_HEADER)?.trim();
  if (fromHeader) return fromHeader;
  return randomUUID();
}

function withRequestId(
  res: NextResponse,
  requestId: string,
): NextResponse {
  res.headers.set(REQUEST_ID_HEADER, requestId);
  return res;
}

export function jsonSuccess<T extends Record<string, unknown>>(
  requestId: string,
  data: T,
  init?: ResponseInit,
): NextResponse {
  return withRequestId(NextResponse.json({ ok: true, ...data }, init), requestId);
}

export function jsonError(
  requestId: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return withRequestId(
    NextResponse.json({ ok: false, error: message, ...extra }, { status }),
    requestId,
  );
}
