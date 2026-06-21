import {
  PROJECTED_BALANCE_PRESET_MONTHS,
} from "@/features/reports/lib/projected-balance";
import type { ProjectedBalanceSelection } from "@/features/reports/lib/projected-balance-url";

export const PROJECTED_BALANCE_PREFERENCES_KEY = "moniq:projected-balance:preferences:v1";
export const PROJECTED_BALANCE_LEGACY_SELECTION_KEY = "moniq:projected-balance:selection";

export type ProjectedBalancePreferences = ProjectedBalanceSelection & {
  version: 1;
  periodMonths: number;
};

function isPresetMonths(value: unknown): value is number {
  return typeof value === "number" &&
    PROJECTED_BALANCE_PRESET_MONTHS.includes(
      value as (typeof PROJECTED_BALANCE_PRESET_MONTHS)[number],
    );
}

export function parseProjectedBalancePreferences(
  value: string | null,
  legacyValue: string | null = null,
): ProjectedBalancePreferences | null {
  for (const candidate of [value, legacyValue]) {
    if (!candidate) continue;

    try {
      const parsed = JSON.parse(candidate) as Partial<ProjectedBalancePreferences>;
      if (!Array.isArray(parsed.accountIds) || typeof parsed.merged !== "boolean") continue;

      return {
        version: 1,
        accountIds: parsed.accountIds.filter(
          (accountId): accountId is string => typeof accountId === "string",
        ),
        merged: parsed.merged,
        periodMonths: isPresetMonths(parsed.periodMonths) ? parsed.periodMonths : 6,
      };
    } catch {
      continue;
    }
  }

  return null;
}

export function serializeProjectedBalancePreferences(
  preferences: Omit<ProjectedBalancePreferences, "version">,
) {
  return JSON.stringify({ version: 1, ...preferences } satisfies ProjectedBalancePreferences);
}
