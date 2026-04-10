import { redirect } from "next/navigation";

export default async function BankingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = new URLSearchParams();
  const resolvedSearchParams = await searchParams;

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        query.append(key, entry);
      }
      continue;
    }

    if (typeof value === "string") {
      query.set(key, value);
    }
  }

  redirect(`/${locale}/imports${query.size ? `?${query.toString()}` : ""}`);
}
