"use client";

import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

type LogoutButtonProps = {
  action: () => Promise<void>;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  label?: string;
};

function LogoutButtonInner({
  className,
  variant = "ghost",
  size = "default",
  label,
}: Omit<LogoutButtonProps, "action">) {
  const t = useTranslations("auth.actions");
  const { pending } = useFormStatus();
  const resolvedLabel = label ?? t("logout");

  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending}>
      <LogOut className="h-4 w-4" />
      {pending ? t("logoutPending") : resolvedLabel}
    </Button>
  );
}

export function LogoutButton({ action, ...props }: LogoutButtonProps) {
  return (
    <form action={action}>
      <LogoutButtonInner {...props} />
    </form>
  );
}
