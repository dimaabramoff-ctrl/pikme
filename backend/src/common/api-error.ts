export interface ApiErrorContract {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export function buildApiError(
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): ApiErrorContract {
  return {
    statusCode,
    code,
    message,
    details,
  };
}
