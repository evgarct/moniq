"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bot, Copy, Check, Plus, Trash2, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/surface";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

interface NewKeyResult extends ApiKey {
  raw_key: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Raw key display — shown once after creation
// ---------------------------------------------------------------------------

function NewKeyBanner({ rawKey }: { rawKey: string }) {
  const t = useTranslations("settings.mcp");
  const [copied, setCopied] = useState(false);

  function copyKey() {
    navigator.clipboard.writeText(rawKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="border-l-2 border-amber-400 bg-amber-50/60 px-4 py-3 dark:bg-amber-950/30">
      <p className="type-body-12 mb-2 font-medium text-amber-800 dark:text-amber-200">
        {t("rawKeyNotice")}
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate font-mono text-[12px] text-amber-900 dark:text-amber-100">
          {rawKey}
        </code>
        <Button size="sm" variant="outline" onClick={copyKey} className="shrink-0">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="ml-1">{copied ? t("copied") : t("copyKey")}</span>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MCP URL snippet (OAuth flow — no auth header needed)
// ---------------------------------------------------------------------------

function McpUrlSnippet({ host }: { host: string }) {
  const t = useTranslations("settings.mcp");
  const [copied, setCopied] = useState(false);
  const url = `${host}/api/mcp`;

  function copyUrl() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative">
      <p className="type-body-12 mb-1 text-muted-foreground">{t("mcpUrlLabel")}</p>
      <div className="flex items-center gap-2 rounded-control bg-secondary px-4 py-3">
        <code className="flex-1 truncate font-mono text-[12px] text-foreground">{url}</code>
        <button
          type="button"
          onClick={copyUrl}
          className="shrink-0 rounded-control p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={t("copyUrl")}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Advanced: manual config snippet (for non-Claude clients)
// ---------------------------------------------------------------------------

function ConfigSnippet({ host }: { host: string }) {
  const t = useTranslations("settings.mcp");
  const [copied, setCopied] = useState(false);
  const snippet = JSON.stringify(
    {
      mcpServers: {
        moniq: {
          type: "http",
          url: `${host}/api/mcp`,
          headers: { Authorization: "Bearer <your-api-key>" },
        },
      },
    },
    null,
    2,
  );

  function copySnippet() {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative">
      <p className="type-body-12 mb-1 text-muted-foreground">{t("configLabel")}</p>
      <pre className="overflow-x-auto rounded-control bg-secondary px-4 py-3 text-[12px] leading-relaxed text-foreground">
        {snippet}
      </pre>
      <button
        type="button"
        onClick={copySnippet}
        className="absolute right-2 top-7 rounded-control p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={t("copyKey")}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function McpSettings({ initialKeys }: { initialKeys: ApiKey[] }) {
  const t = useTranslations("settings.mcp");
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<NewKeyResult | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [host] = useState(() =>
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : ""),
  );

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/mcp/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: NewKeyResult = await res.json();
      setNewKey(data);
      setKeys((prev) => [data, ...prev]);
      setNewKeyName("");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    setRevokingId(id);
    try {
      await fetch(`/api/mcp/api-keys/${id}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== id));
      if (newKey?.id === id) setNewKey(null);
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Bot className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div>
          <h2 className="type-h5 text-foreground">{t("title")}</h2>
          <p className="type-body-14 mt-0.5 text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {/* OAuth setup — primary path */}
      <Surface tone="panel" padding="lg">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("setupTitle")}
        </p>
        <ol className="flex flex-col gap-5">
          <li className="flex gap-3">
            <span className="type-body-12 mt-px shrink-0 font-semibold text-muted-foreground">1.</span>
            <p className="type-body-14 text-foreground">{t("oauthStep1")}</p>
          </li>
          <li className="pl-5">
            <McpUrlSnippet host={host} />
          </li>
          <li className="flex gap-3">
            <span className="type-body-12 mt-px shrink-0 font-semibold text-muted-foreground">2.</span>
            <p className="type-body-14 text-foreground">{t("oauthStep2")}</p>
          </li>
          <li className="flex gap-3">
            <span className="type-body-12 mt-px shrink-0 font-semibold text-muted-foreground">3.</span>
            <p className="type-body-14 text-foreground">{t("oauthStep3")}</p>
          </li>
        </ol>
      </Surface>

      {/* Advanced section — non-Claude clients */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="type-body-12 text-muted-foreground underline-offset-2 hover:underline"
        >
          {showAdvanced ? t("advancedHide") : t("advancedShow")}
        </button>

        {showAdvanced && (
          <div className="mt-4">
            <Surface tone="panel" padding="lg">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t("advancedTitle")}
              </p>
              <p className="type-body-14 mb-4 text-muted-foreground">{t("advancedDescription")}</p>
              <ConfigSnippet host={host} />
            </Surface>
          </div>
        )}
      </div>

      {/* API Keys */}
      <Surface tone="panel" padding="lg">
        <div className="mb-5">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("apiKeysTitle")}
          </p>
          <p className="type-body-14 text-muted-foreground">{t("apiKeysDescription")}</p>
        </div>

        {/* Create key form (advanced / non-Claude usage) */}
        <form onSubmit={createKey} className="mb-5 flex gap-2">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder={t("newKeyNamePlaceholder")}
            aria-label={t("newKeyName")}
            className="flex-1 rounded-control border border-border bg-background px-3 py-2 type-body-14 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" disabled={creating || !newKeyName.trim()} size="sm">
            {creating ? (
              t("creating")
            ) : (
              <>
                <Plus className="h-4 w-4" />
                {t("createKey")}
              </>
            )}
          </Button>
        </form>

        {/* New key banner */}
        {newKey && (
          <div className="mb-5 -mx-5">
            <NewKeyBanner rawKey={newKey.raw_key} />
          </div>
        )}

        {/* Keys list */}
        {keys.length === 0 ? (
          <p className="py-6 text-center type-body-14 text-muted-foreground">{t("noKeys")}</p>
        ) : (
          <div className="flex flex-col">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center gap-3 border-t border-border py-3 first:border-t-0"
              >
                <Key className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <div className="flex-1 min-w-0">
                  <p className="type-body-14 font-medium text-foreground truncate">{key.name}</p>
                  <p className="type-body-12 text-muted-foreground">
                    <code className="font-mono">{key.key_prefix}…</code>
                    {" · "}
                    {t("created")} {formatDate(key.created_at)}
                    {key.last_used_at && (
                      <> · {t("lastUsed")} {formatDate(key.last_used_at)}</>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revokeKey(key.id)}
                  disabled={revokingId === key.id}
                  className="rounded-control p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  aria-label={t("revokeKey")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Surface>
    </div>
  );
}
