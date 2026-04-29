let csrfToken;

const isSafeMethod = (method) => ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

const fetchJson = async (input, init) => {
  const response = await fetch(input, {
    credentials: 'same-origin',
    ...init,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const error = new Error(data?.error || 'Request failed.');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const getCsrfToken = async (forceRefresh = false) => {
  if (!csrfToken || forceRefresh) {
    const data = await fetchJson('/api/auth/csrf-token');
    csrfToken = data.csrfToken;
  }

  return csrfToken;
};

export const apiRequest = async (url, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;

  const requestOptions = {
    method,
    headers,
  };

  if (!isSafeMethod(method)) {
    headers.set('X-CSRF-Token', await getCsrfToken(options.forceRefreshCsrf));
  }

  if (options.body !== undefined) {
    if (isFormData) {
      requestOptions.body = options.body;
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
    if (error.status === 403 && !isSafeMethod(method) && !options.forceRefreshCsrf) {
      return apiRequest(url, { ...options, forceRefreshCsrf: true });
    }

    throw error;
  }
};
