export const MONIQ_WIDGET_URI = "ui://moniq/finance-result.html";
export const MONIQ_WIDGET_MIME_TYPE = "text/html;profile=mcp-app";

export function moniqWidgetMeta(invoking: string, invoked: string) {
  return {
    ui: { resourceUri: MONIQ_WIDGET_URI },
    "openai/outputTemplate": MONIQ_WIDGET_URI,
    "openai/widgetAccessible": true,
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked,
  };
}

export const MONIQ_WIDGET_RESOURCE_META = {
  "openai/widgetDescription": "A compact, human-readable Moniq finance summary.",
  "openai/widgetPrefersBorder": true,
  "openai/widgetCSP": {
    connect_domains: [],
    resource_domains: [],
  },
};

export function moniqWidgetHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: transparent; color: #292824; }
    .surface { overflow: hidden; border: 1px solid rgba(64,64,62,.14); border-radius: 12px; background: #fafaf7; }
    .header { padding: 14px 15px 11px; }
    .eyebrow { margin: 0 0 3px; color: #77736b; font-size: 10px; font-weight: 700; letter-spacing: .1em; line-height: 1.3; text-transform: uppercase; }
    h1 { margin: 0; color: #292824; font-size: 15px; font-weight: 680; line-height: 1.35; }
    .message { margin: 5px 0 0; color: #68645d; font-size: 12px; line-height: 1.45; }
    .summary { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 0 15px 11px; color: #68645d; font-size: 11px; }
    .rows { border-top: 1px solid rgba(64,64,62,.11); }
    .row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 12px; padding: 10px 15px; border-bottom: 1px solid rgba(64,64,62,.08); }
    .row:last-child { border-bottom: 0; }
    .primary { overflow: hidden; color: #292824; font-size: 13px; font-weight: 620; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
    .meta, .note, .breakdown { margin-top: 2px; color: #77736b; font-size: 11px; line-height: 1.4; }
    .note { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .amount { align-self: start; color: #292824; font-size: 13px; font-variant-numeric: tabular-nums; font-weight: 620; line-height: 1.35; text-align: right; white-space: nowrap; }
    .amount.secondary { margin-top: 2px; color: #77736b; font-size: 11px; font-weight: 500; }
    .empty { padding: 14px 15px; color: #77736b; font-size: 12px; }
    .more { padding: 8px 15px 10px; border-top: 1px solid rgba(64,64,62,.08); color: #77736b; font-size: 11px; }
    @media (prefers-color-scheme: dark) {
      body { color: #f2efe8; }
      .surface { border-color: rgba(255,255,255,.12); background: #1f1e1b; }
      h1, .primary, .amount { color: #f2efe8; }
      .eyebrow, .message, .summary, .meta, .note, .breakdown, .amount.secondary, .empty, .more { color: #aaa49a; }
      .rows, .row, .more { border-color: rgba(255,255,255,.09); }
    }
  </style>
</head>
<body>
  <main class="surface">
    <header class="header">
      <p class="eyebrow">Moniq</p>
      <h1 id="title"></h1>
      <p class="message" id="message" hidden></p>
    </header>
    <div class="summary" id="summary" hidden></div>
    <div class="rows" id="rows"></div>
    <div class="more" id="more" hidden></div>
  </main>
  <script>
    const api = window.openai || {};
    const MAX_ROWS = 8;
    let currentData = api.toolOutput || api.structuredContent || {};
    const locale = String(api.locale || navigator.language || "en").toLowerCase().startsWith("ru") ? "ru" : "en";
    const copy = {
      en: { transactions: "Transactions", balances: "Balances", report: "Category report", recurring: "Recurring transactions", result: "Moniq result", empty: "Nothing to show", more: "more", paid: "Paid", planned: "Planned", skipped: "Skipped", active: "Active", paused: "Paused", income: "Income", expense: "Expense", transfer: "Transfer", debt_payment: "Debt payment", daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly", principal: "principal", interest: "interest", extra: "extra principal" },
      ru: { transactions: "Транзакции", balances: "Балансы", report: "Отчёт по категориям", recurring: "Регулярные транзакции", result: "Результат Moniq", empty: "Нет данных", more: "ещё", paid: "Оплачено", planned: "Запланировано", skipped: "Пропущено", active: "Активно", paused: "Приостановлено", income: "Доход", expense: "Расход", transfer: "Перевод", debt_payment: "Платёж по долгу", daily: "Ежедневно", weekly: "Еженедельно", monthly: "Ежемесячно", yearly: "Ежегодно", principal: "основной долг", interest: "проценты", extra: "досрочно" }
    }[locale];

    function text(value) { return value == null ? "" : String(value); }
    function escapeHtml(value) { return text(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); }
    function number(value, currency) {
      const amount = Number(value);
      if (!Number.isFinite(amount)) return "";
      const formatted = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", { maximumFractionDigits: 2 }).format(amount);
      return currency ? formatted + " " + currency : formatted;
    }
    function date(value) {
      if (!value) return "";
      const parsed = new Date(String(value).slice(0, 10) + "T00:00:00Z");
      return Number.isNaN(parsed.valueOf()) ? text(value) : new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB").format(parsed);
    }
    function label(value) { return copy[value] || text(value).replace(/_/g, " "); }
    function accountText(item) {
      if (item.source_account_name && item.destination_account_name) return item.source_account_name + " → " + item.destination_account_name;
      return item.source_account_name || item.destination_account_name || "";
    }
    function transactionRows(items) {
      return items.map((item) => {
        const cadence = item.frequency ? label(item.frequency) + (item.frequency === "weekly" && item.interval_weeks > 1 ? " × " + item.interval_weeks : "") : "";
        const meta = [date(item.occurred_at || item.start_date), label(item.status || item.state), cadence, accountText(item), item.category_path || item.category_name].filter(Boolean).join(" · ");
        const parts = [
          item.principal_amount != null ? copy.principal + ": " + number(item.principal_amount, item.currency) : "",
          item.interest_amount != null ? copy.interest + ": " + number(item.interest_amount, item.currency) : "",
          item.extra_principal_amount ? copy.extra + ": " + number(item.extra_principal_amount, item.currency) : ""
        ].filter(Boolean).join(" · ");
        const destination = item.destination_amount != null && item.destination_amount !== item.amount
          ? '<div class="amount secondary">' + escapeHtml(number(item.destination_amount, item.destination_currency || item.currency)) + '</div>'
          : "";
        const displayedAmount = item.outstanding_amount != null && (item.type === "credit_card" || item.type === "debt") ? item.outstanding_amount : (item.amount ?? item.balance ?? item.outstanding_amount);
        return '<div class="row"><div><div class="primary">' + escapeHtml(item.title || item.name || copy.result) + '</div>' +
          (meta ? '<div class="meta">' + escapeHtml(meta) + '</div>' : "") +
          (item.note ? '<div class="note">' + escapeHtml(item.note) + '</div>' : "") +
          (parts ? '<div class="breakdown">' + escapeHtml(parts) + '</div>' : "") +
          '</div><div><div class="amount">' + escapeHtml(number(displayedAmount, item.currency)) + '</div>' + destination + '</div></div>';
      });
    }
    function detect(data) {
      if (Array.isArray(data.items)) return { title: data.title || copy.result, message: data.message || "", rows: data.items, summary: data.counts };
      if (Array.isArray(data.transactions)) return { title: copy.transactions, rows: data.transactions, summary: { count: data.transactions.length } };
      if (Array.isArray(data.schedules)) return { title: copy.recurring, rows: data.schedules, summary: { count: data.schedules.length } };
      if (Array.isArray(data.cards) || Array.isArray(data.debts)) return { title: copy.balances, rows: [...(data.cards || []), ...(data.debts || [])], summary: data.totals_by_currency };
      if (Array.isArray(data.envelopes)) {
        const rows = data.envelopes.flatMap((entry) => (entry.totals || []).map((total) => ({ title: entry.name, amount: total.amount, currency: total.currency })));
        return { title: copy.report, rows, summary: data.summary };
      }
      if (data.created || data.updated || data.deleted || data.schedule) {
        const rows = [data.created, data.updated, data.deleted, data.schedule].flatMap((value) => Array.isArray(value) ? value : value ? [value] : []);
        return { title: copy.result, rows };
      }
      return { title: data.title || copy.result, message: data.message || "", rows: [] };
    }
    function render(data) {
      const view = detect(data && typeof data === "object" ? data : {});
      document.getElementById("title").textContent = view.title;
      const message = document.getElementById("message");
      message.textContent = view.message || "";
      message.hidden = !view.message;
      const summary = document.getElementById("summary");
      const summaryEntries = view.summary && typeof view.summary === "object" && !Array.isArray(view.summary)
        ? Object.entries(view.summary).filter(([, value]) => typeof value === "string" || typeof value === "number")
        : [];
      summary.innerHTML = summaryEntries.map(([key, value]) => '<span>' + escapeHtml(label(key)) + ': ' + escapeHtml(value) + '</span>').join("");
      summary.hidden = summaryEntries.length === 0;
      const rows = Array.isArray(view.rows) ? view.rows : [];
      document.getElementById("rows").innerHTML = rows.length ? transactionRows(rows.slice(0, MAX_ROWS)).join("") : '<div class="empty">' + escapeHtml(copy.empty) + '</div>';
      const more = document.getElementById("more");
      more.textContent = rows.length > MAX_ROWS ? "+" + (rows.length - MAX_ROWS) + " " + copy.more : "";
      more.hidden = rows.length <= MAX_ROWS;
      if (api.notifyIntrinsicHeight) api.notifyIntrinsicHeight();
    }
    window.addEventListener("message", (event) => {
      if (event.source !== window.parent) return;
      const message = event.data;
      if (message && message.jsonrpc === "2.0" && message.method === "ui/notifications/tool-result") {
        currentData = message.params?.structuredContent || {};
        render(currentData);
      }
    }, { passive: true });
    render(currentData);
  </script>
</body>
</html>`;
}
