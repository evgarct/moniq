const GOCARDLESS_API = process.env.GOCARDLESS_API_URL ?? "https://bankaccountdata.gocardless.com/api/v2";

type TokenResponse = {
  access: string;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const secretId = process.env.GOCARDLESS_SECRET_ID;
  const secretKey = process.env.GOCARDLESS_SECRET_KEY;

  if (!secretId || !secretKey) {
    throw new Error("GoCardless credentials are missing.");
  }

  const response = await fetch(`${GOCARDLESS_API}/token/new/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to authorize GoCardless.");
  }

  const data = (await response.json()) as TokenResponse;
  cachedToken = {
    token: data.access,
    expiresAt: Date.now() + 50 * 60 * 1000,
  };

  return data.access;
}

async function goCardlessFetch<T>(path: string, init?: RequestInit) {
  const token = await getAccessToken();
  const response = await fetch(`${GOCARDLESS_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GoCardless request failed for ${path}`);
  }

  return response.json() as Promise<T>;
}

export type GoCardlessAccount = {
  id: string;
  iban?: string;
  currency?: string;
  name?: string;
};

export type GoCardlessTransaction = {
  transactionId?: string;
  bookingDate: string;
  transactionAmount: {
    amount: string;
    currency: string;
  };
  creditorName?: string;
  debtorName?: string;
  remittanceInformationUnstructured?: string;
};

export async function createRequisition() {
  const institutionId = process.env.GOCARDLESS_INSTITUTION_ID;
  const redirect = process.env.GOCARDLESS_REDIRECT_URL;

  if (!institutionId || !redirect) {
    throw new Error("GoCardless requisition config is missing.");
  }

  return goCardlessFetch<{ id: string; link: string }>("/requisitions/", {
    method: "POST",
    body: JSON.stringify({
      institution_id: institutionId,
      redirect,
      reference: `moniq-${Date.now()}`,
    }),
  });
}

export async function getRequisition(requisitionId: string) {
  return goCardlessFetch<{ id: string; accounts: string[] }>(`/requisitions/${requisitionId}/`);
}

export async function getAccountDetails(accountId: string) {
  return goCardlessFetch<{ account: GoCardlessAccount }>(`/accounts/${accountId}/details/`);
}

export async function getAccountTransactions(accountId: string, dateFrom?: string) {
  const query = dateFrom ? `?date_from=${encodeURIComponent(dateFrom)}` : "";
  return goCardlessFetch<{
    transactions: { booked?: GoCardlessTransaction[]; pending?: GoCardlessTransaction[] };
  }>(`/accounts/${accountId}/transactions/${query}`);
}
