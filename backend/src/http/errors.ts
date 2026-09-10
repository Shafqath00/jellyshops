import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";

export interface ApiIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues?: ApiIssue[],
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new ApiError(404, "NOT_FOUND", "The requested resource was not found"));
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const apiError = error instanceof ApiError
    ? error
    : error instanceof z.ZodError
      ? new ApiError(
        400,
        "REQUEST_INVALID",
        "The request is invalid",
        error.issues.map((issue) => ({
          path: issue.path.length > 0 ? issue.path.join(".") : "body",
          message: issue.message,
        })),
      )
      : new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred");

  response.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.issues ? { issues: apiError.issues } : {}),
      ...(typeof (error as { currentRevision?: unknown }).currentRevision === "number"
        ? { currentRevision: (error as { currentRevision: number }).currentRevision }
        : {}),
      requestId: request.id,
    },
  });
};
