/**
 * ArcID SDK HTTP Client
 *
 * Pure TypeScript fetch wrapper with token refresh support.
 * No React/Next.js dependencies — can be extracted as a standalone package.
 */

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

export type ApiResponse<T> = { data: T; error: null } | { data: null; error: ApiError };

type TokenGetter = () => string | null;
type TokenRefresher = () => Promise<string | null>;
type OnAuthCleared = () => void;

export interface SdkClientOptions {
  baseUrl: string;
  getAccessToken: TokenGetter;
  refreshToken?: TokenRefresher;
  onAuthCleared?: OnAuthCleared;
}

export function createSdkClient(options: SdkClientOptions) {
  const { baseUrl, getAccessToken, refreshToken, onAuthCleared } = options;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const token = getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${baseUrl}${path}`;

    try {
      let res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Attempt token refresh on 401
      if (res.status === 401 && refreshToken) {
        const newToken = await refreshToken();
        if (newToken) {
          headers["Authorization"] = `Bearer ${newToken}`;
          res = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
          });
        } else {
          onAuthCleared?.();
          return {
            data: null,
            error: { statusCode: 401, error: "Unauthorized", message: "Session expired" },
          };
        }
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        return {
          data: null,
          error: {
            statusCode: res.status,
            error: errBody.error ?? "Unknown",
            message: errBody.message ?? `Request failed with status ${res.status}`,
          },
        };
      }

      // Handle 204 No Content
      if (res.status === 204) {
        return { data: undefined as T, error: null };
      }

      const json = await res.json();
      return { data: json as T, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          statusCode: 0,
          error: "NetworkError",
          message: err instanceof Error ? err.message : "Unknown network error",
        },
      };
    }
  }

  return {
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
    put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
    patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
    delete: <T>(path: string) => request<T>("DELETE", path),
  };
}

export type SdkClient = ReturnType<typeof createSdkClient>;
