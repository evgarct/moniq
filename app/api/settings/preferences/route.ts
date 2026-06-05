import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { updateUserPreferences } from "@/features/finance/server/repository";
import { withApiPerformance } from "@/lib/performance/api";
import { userPreferencesInputSchema } from "@/types/finance-schemas";

export async function PATCH(request: Request) {
  return withApiPerformance(request, "settings_preferences_update", async () => {
    try {
      const payload = userPreferencesInputSchema.parse(await request.json());
      const snapshot = await updateUserPreferences(payload);

      return NextResponse.json(snapshot);
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.settings.preferencesUpdate");
    }
  });
}
