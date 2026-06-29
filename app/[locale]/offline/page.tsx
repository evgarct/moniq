import { getTranslations } from "next-intl/server";

import { Surface, SurfaceDescription, SurfaceHeader, SurfaceTitle } from "@/components/surface";

export default async function OfflinePage() {
  const t = await getTranslations("offline");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-10">
      <Surface tone="panel" padding="lg" className="w-full max-w-lg">
        <SurfaceHeader>
          <SurfaceTitle>{t("title")}</SurfaceTitle>
          <SurfaceDescription>{t("description")}</SurfaceDescription>
        </SurfaceHeader>
      </Surface>
    </main>
  );
}
