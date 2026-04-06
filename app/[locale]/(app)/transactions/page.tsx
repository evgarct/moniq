import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";

type TransactionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const locale = await getLocale();
  const nextSearchParams = searchParams ? await searchParams : {};
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(nextSearchParams)) {
    if (typeof value === "string" && value.length > 0) {
      query[key] = value;
      continue;
    }

    if (Array.isArray(value) && value.length > 0) {
      query[key] = value;
    }
  }

  return redirect({
    href: {
      pathname: "/budget",
      query,
    },
    locale,
  });
}
