import "server-only";

import { createSign, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

type EnableBankingSessionResponse = {
  session_id: string;
  accounts?: string[];
  access?: {
    valid_until?: string;
  };
};

type EnableBankingSessionData = {
  status?: string;
  accounts?: string[];
  accounts_data?: Array<{ uid?: string }>;
  aspsp?: {
    name?: string;
    country?: string;
  };
  access?: {
    valid_until?: string;
  };
};

type EnableBankingAccountDetails = {
  uid?: string;
  name?: string;
  details?: string;
  currency?: string;
  account_id?: {
    iban?: string;
    other?: {
      identification?: string;
    };
  };
};

type EnableBankingTransactionsResponse = {
  transactions?: Array<{
    transaction_id?: string;
    entry_reference?: string;
    transaction_amount?: {
      amount?: string;
      currency?: string;
    };
    credit_debit_indicator?: "CRDT" | "DBIT" | string;
    booking_date?: string;
    transaction_date?: string;
    value_date?: string;
    debtor?: { name?: string };
    creditor?: { name?: string };
    remittance_information?: string[];
    note?: string;
  }>;
  continuation_key?: string;
};

type StartAuthorizationRequest = {
  access: {
    accounts: string[];
  };
  aspsp: {
    name: string;
    country?: string;
  };
  state: string;
  redirect_url: string;
  psu_type?: "personal" | "business";
};

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

async function getEnableBankingConfig() {
  const applicationId = process.env.ENABLE_BANKING_APPLICATION_ID?.trim();
  const privateKeyPath = process.env.ENABLE_BANKING_PRIVATE_KEY_PATH?.trim();
  const privateKeyPem = process.env.ENABLE_BANKING_PRIVATE_KEY_PEM?.trim();
  const baseUrl = process.env.ENABLE_BANKING_BASE_URL?.trim() || "https://api.enablebanking.com";
  const defaultRedirectUrl =
    process.env.ENABLE_BANKING_REDIRECT_URL?.trim() || "http://localhost:3000/api/banking/callback";
  const defaultAspspName = process.env.ENABLE_BANKING_ASPSP_NAME?.trim() || "MockBank";
  const defaultAspspCountry = process.env.ENABLE_BANKING_ASPSP_COUNTRY?.trim() || undefined;

  if (!applicationId) {
    throw new Error("Enable Banking application ID is not configured.");
  }

  if (!privateKeyPath && !privateKeyPem) {
    throw new Error("Enable Banking private key is not configured.");
  }

  return {
    applicationId,
    privateKeyPath,
    privateKeyPem,
    baseUrl,
    defaultRedirectUrl,
    defaultAspspName,
    defaultAspspCountry,
  };
}

async function createApplicationJwt() {
  const config = await getEnableBankingConfig();
  const privateKey = config.privateKeyPem
    ? config.privateKeyPem.replace(/\\n/g, "\n")
    : await readFile(config.privateKeyPath!, "utf8");
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 60 * 60;

  const header = {
    typ: "JWT",
    alg: "RS256",
    kid: config.applicationId,
  };

  const payload = {
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: issuedAt,
    exp: expiresAt,
    jti: randomUUID(),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();

  const signature = signer.sign(privateKey, "base64url");
  return `${signingInput}.${signature}`;
}

async function enableBankingFetch<T>(path: string, init: RequestInit = {}) {
  const config = await getEnableBankingConfig();
  const jwt = await createApplicationJwt();
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${jwt}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const details =
      payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
        ? payload.detail
        : payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : typeof payload === "string" && payload
            ? payload
            : `Enable Banking request failed with status ${response.status}.`;

    throw new Error(details);
  }

  return payload as T;
}

function extractRedirectUrl(payload: unknown) {
  if (typeof payload === "string") {
    return payload;
  }

  if (payload && typeof payload === "object") {
    for (const key of ["url", "auth_url", "redirect_url", "authorization_url"] as const) {
      const value = payload[key as keyof typeof payload];
      if (typeof value === "string" && value) {
        return value;
      }
    }
  }

  throw new Error("Enable Banking did not return an authorization URL.");
}

export async function getEnableBankingDefaults() {
  const config = await getEnableBankingConfig();
  return {
    redirectUrl: config.defaultRedirectUrl,
    aspspName: config.defaultAspspName,
    aspspCountry: config.defaultAspspCountry,
  };
}

export async function startEnableBankingAuthorization(request: StartAuthorizationRequest) {
  const payload = await enableBankingFetch<unknown>("/auth", {
    method: "POST",
    body: JSON.stringify(request),
  });

  return {
    redirectUrl: extractRedirectUrl(payload),
  };
}

export async function createEnableBankingSession(code: string) {
  return enableBankingFetch<EnableBankingSessionResponse>("/sessions", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function getEnableBankingSession(sessionId: string) {
  return enableBankingFetch<EnableBankingSessionData>(`/sessions/${sessionId}`);
}

export async function getEnableBankingAccountDetails(accountId: string) {
  return enableBankingFetch<EnableBankingAccountDetails>(`/accounts/${accountId}/details`);
}

export async function getEnableBankingAccountTransactions(accountId: string, dateFrom?: string) {
  const params = new URLSearchParams();
  if (dateFrom) {
    params.set("date_from", dateFrom);
  }

  const suffix = params.size ? `?${params.toString()}` : "";
  return enableBankingFetch<EnableBankingTransactionsResponse>(`/accounts/${accountId}/transactions${suffix}`);
}
