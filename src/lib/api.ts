import { NextResponse } from "next/server";

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function apiFailure(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      details,
    },
    { status },
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof HttpError) {
    return apiFailure(error.message, error.status, error.details);
  }

  if (error instanceof Error) {
    console.error(error);
    return apiFailure(error.message, 500);
  }

  console.error(error);
  return apiFailure("Unexpected server error", 500);
}
