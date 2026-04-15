import { NextResponse } from "next/server";
import { applyRequestTracingHeaders } from "@/lib/api/http";

type ApiMeta = {
  requestId: string;
  correlationId?: string;
};

type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export function jsonContractSuccess<T extends Record<string, unknown>>(
  meta: ApiMeta,
  data: T,
  init?: ResponseInit,
): NextResponse {
  return applyRequestTracingHeaders(
    NextResponse.json(
      {
        ok: true,
        data,
        meta: {
          requestId: meta.requestId,
          correlationId: meta.correlationId ?? meta.requestId,
        },
      },
      init,
    ),
    meta,
  );
}

export function jsonContractError(
  meta: ApiMeta,
  error: ApiError,
  status: number,
): NextResponse {
  return applyRequestTracingHeaders(
    NextResponse.json(
      {
        ok: false,
        error,
        meta: {
          requestId: meta.requestId,
          correlationId: meta.correlationId ?? meta.requestId,
        },
      },
      { status },
    ),
    meta,
  );
}

