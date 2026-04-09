/**
 * Podio API client for server-side use only.
 * Uses OAuth2 password/refresh_token flow (user-level auth).
 * Supports accessing multiple apps across workspaces.
 */

const PODIO_API = "https://api.podio.com";

let tokenCache: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  // Use refresh token to get a new access token
  const refreshToken =
    tokenCache?.refreshToken ?? process.env.PODIO_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error("No PODIO_REFRESH_TOKEN available");
  }

  const res = await fetch(`${PODIO_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.PODIO_CLIENT_ID!,
      client_secret: process.env.PODIO_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Podio auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  tokenCache = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

async function podioFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`${PODIO_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
    tokenCache = null;
    const newToken = await getAccessToken();
    return fetch(`${PODIO_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${newToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  }

  if (res.status === 420) {
    const retryAfter = res.headers.get("Retry-After") || "60";
    throw new Error(`Podio rate limited. Retry after ${retryAfter}s`);
  }

  return res;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getItem(itemId: number): Promise<PodioItem> {
  const res = await podioFetch(`/item/${itemId}`);
  if (!res.ok) {
    throw new Error(`Podio getItem ${itemId} failed (${res.status})`);
  }
  return res.json();
}

export async function filterItems(
  appId: number,
  filters: Record<string, unknown> = {},
  options: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDesc?: boolean;
  } = {}
): Promise<{ items: PodioItem[]; total: number; filtered: number }> {
  const body: Record<string, unknown> = {
    filters,
    limit: options.limit ?? 100,
    offset: options.offset ?? 0,
  };
  if (options.sortBy) {
    body.sort_by = options.sortBy;
    body.sort_desc = options.sortDesc ?? false;
  }

  const res = await podioFetch(`/item/app/${appId}/filter/`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Podio filterItems app ${appId} failed (${res.status}): ${text}`
    );
  }

  return res.json();
}

export async function updateItem(
  itemId: number,
  fields: Record<string, unknown>
): Promise<void> {
  const res = await podioFetch(`/item/${itemId}`, {
    method: "PUT",
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Podio updateItem ${itemId} failed (${res.status}): ${text}`
    );
  }
}

export async function createItem(
  appId: number,
  fields: Record<string, unknown>
): Promise<{ item_id: number }> {
  const res = await podioFetch(`/item/app/${appId}/`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Podio createItem app ${appId} failed (${res.status}): ${text}`
    );
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Field value helpers
// ---------------------------------------------------------------------------

export function getFieldValue(
  item: PodioItem,
  fieldId: number | string
): unknown {
  const field = item.fields?.find(
    (f) =>
      f.field_id === Number(fieldId) || f.external_id === String(fieldId)
  );
  if (!field || !field.values?.length) return undefined;
  return field.values;
}

export function getTextValue(
  item: PodioItem,
  fieldId: number | string
): string {
  const vals = getFieldValue(item, fieldId);
  if (!Array.isArray(vals) || !vals.length) return "";
  return vals[0]?.value ?? "";
}

export function getCategoryValue(
  item: PodioItem,
  fieldId: number | string
): string {
  const vals = getFieldValue(item, fieldId);
  if (!Array.isArray(vals) || !vals.length) return "";
  return vals[0]?.value?.text ?? "";
}

export function getCategoryValues(
  item: PodioItem,
  fieldId: number | string
): string[] {
  const vals = getFieldValue(item, fieldId);
  if (!Array.isArray(vals)) return [];
  return vals.map((v) => v?.value?.text ?? "").filter(Boolean);
}

export function getNumberValue(
  item: PodioItem,
  fieldId: number | string
): number | null {
  const vals = getFieldValue(item, fieldId);
  if (!Array.isArray(vals) || !vals.length) return null;
  const raw = vals[0]?.value;
  return raw != null ? Number(raw) : null;
}

export function getAppReferenceIds(
  item: PodioItem,
  fieldId: number | string
): number[] {
  const vals = getFieldValue(item, fieldId);
  if (!Array.isArray(vals)) return [];
  return vals
    .map((v) => v?.value?.item_id)
    .filter((id): id is number => id != null);
}

// ---------------------------------------------------------------------------
// Known Podio App IDs
// ---------------------------------------------------------------------------

export const PODIO_APPS = {
  TESTS: 16243239,
  QB_MULTI_CHOICE: 16263017,
  DOMAINS: 16336321,
  PRACTICE_EXAM_BUILDER: 30393890,
  PLATFORM_PROFILES: 30640719,
  PROFESSIONAL_CREDENTIALS: 19824388,
  CONTACTS: 14660191,
} as const;

export const TEST_FIELDS = {
  TEST_NAME: 125981694,
  TEST_TYPE: 125981849,
  TEST_DESCRIPTION: 126284053,
  NUMBER_OF_QUESTIONS: 125981850,
  DOMAINS: 126809748,
  QUESTIONS: 126756811,
  TIME_LIMIT: 125981853,
  PASSING_SCORE: 125981851,
  TEST_STATUS: 125981847,
  TYPE: 137578152,
  TEST_RESULT_PROCESSING: 150300363,
} as const;

export const DOMAIN_FIELDS = {
  TITLE: 126809667,
  STATUS: 273027679,
  CREDENTIAL: 126809669,
  CPC_QUESTION_COUNT: 273027773,
} as const;

export const PROFILE_FIELDS = {
  EMAIL: "email-2",
  PASSWORD: "password-2",
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PodioItem {
  item_id: number;
  app_item_id: number;
  title: string;
  fields: PodioField[];
  created_on: string;
  last_event_on: string;
}

export interface PodioField {
  field_id: number;
  external_id: string;
  type: string;
  label: string;
  values: PodioFieldValue[];
}

export interface PodioFieldValue {
  value: unknown;
}
