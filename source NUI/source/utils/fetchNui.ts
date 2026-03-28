import { isEnvBrowser } from './misc';
import { mockFetchNui, isMockEnabled } from '~/mocks';

type NuiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: string | { code?: string; message?: string; details?: unknown };
  message?: string;
};

type JsonRecord = Record<string, unknown>;

const nativeFetch = window.fetch.bind(window);

function getBaseUrl(): string {
  const getParentResourceName = (window as any).GetParentResourceName;
  if (typeof getParentResourceName === 'function') {
    const resourceName = getParentResourceName();
    if (typeof resourceName === 'string' && resourceName.trim().length > 0) {
      return `https://${resourceName}`;
    }
  }

  return 'https://cad-system';
}

function getErrorMessage(value: unknown, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    const errorObj = value as JsonRecord;
    if (typeof errorObj.message === 'string') return errorObj.message;
    if (typeof errorObj.code === 'string') return errorObj.code;
  }

  return fallback;
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function nativeFetchNui<TResponse = unknown, TRequest = unknown>(
  eventName: string,
  data?: TRequest
): Promise<TResponse> {
  const response = await nativeFetch(`${getBaseUrl()}/${eventName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(data ?? {}),
  });

  const parsed = await parseJsonSafe(response);

  if (!response.ok) {
    const message = getErrorMessage((parsed as JsonRecord | null)?.error, `HTTP ${response.status}`);
    throw new Error(message);
  }

  if (parsed == null) {
    throw new Error(`Empty response from event: ${eventName}`);
  }

  if (typeof parsed === 'object' && !Array.isArray(parsed)) {
    const envelope = parsed as NuiEnvelope<TResponse>;

    if (envelope.ok === false) {
      throw new Error(getErrorMessage(envelope.error, envelope.message || 'NUI request failed'));
    }

    if (envelope.error) {
      throw new Error(getErrorMessage(envelope.error, 'NUI request failed'));
    }

    if (Object.prototype.hasOwnProperty.call(envelope, 'data')) {
      return envelope.data as TResponse;
    }
  }

  return parsed as TResponse;
}

export async function fetchNui<TResponse = unknown, TRequest = unknown>(
  eventName: string,
  data?: TRequest
): Promise<TResponse> {
  if (isEnvBrowser() && import.meta.env.DEV && isMockEnabled()) {
    console.log(`[MOCK] fetchNui: ${eventName}`, data);
    return mockFetchNui<TResponse>(eventName, data);
  }

  return nativeFetchNui<TResponse, TRequest>(eventName, data);
}
