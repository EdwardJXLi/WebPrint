let csrfToken: string | undefined;

interface ApiErrorPayload {
  error?: string;
  [key: string]: unknown;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown>;
  forceRefreshCsrf?: boolean;
}

export class ApiError extends Error {
  status: number;
  data: ApiErrorPayload | null;

  constructor(message: string, status: number, data: ApiErrorPayload | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const isSafeMethod = (method: string) => ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

const fetchJson = async <T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: 'same-origin',
    ...init,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? ((await response.json()) as ApiErrorPayload) : null;

  if (!response.ok) {
    throw new ApiError(data?.error || 'Request failed.', response.status, data);
  }

  return data as T;
};

export const getCsrfToken = async (forceRefresh = false) => {
  if (!csrfToken || forceRefresh) {
    const data = await fetchJson<{ csrfToken: string }>('/api/auth/csrf-token');
    csrfToken = data.csrfToken;
  }

  return csrfToken;
};

export const apiRequest = async <T = any>(url: string, options: ApiRequestOptions = {}): Promise<T> => {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;

  const requestOptions: RequestInit = {
    method,
    headers,
  };

  if (!isSafeMethod(method)) {
    headers.set('X-CSRF-Token', await getCsrfToken(options.forceRefreshCsrf));
  }

  if (options.body !== undefined) {
    if (isFormData) {
      requestOptions.body = options.body as FormData;
    } else if (typeof options.body === 'string') {
      requestOptions.body = options.body;
    } else {
      headers.set('Content-Type', 'application/json');
      requestOptions.body = JSON.stringify(options.body);
    }
  }

  try {
    return await fetchJson(url, requestOptions);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403 && !isSafeMethod(method) && !options.forceRefreshCsrf) {
      return apiRequest(url, { ...options, forceRefreshCsrf: true });
    }

    throw error;
  }
};
