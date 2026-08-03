export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface RealtimeEvent<T> {
  id: string;
  type: string;
  occurredAt: string;
  version: number;
  data: T;
}
