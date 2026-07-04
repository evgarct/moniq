"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

export default function ProjectedBalanceRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/reports?type=projected");
  }, [router]);

  return null;
}
