"use client";

import * as React from "react";
import { Badge as AstryxBadge } from "@astryxdesign/core/Badge";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";
}

function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  // Map our variant to Astryx variant
  let astryxVariant: "neutral" | "info" | "success" | "warning" | "error" = "neutral";
  if (variant === "destructive") {
    astryxVariant = "error";
  }

  return (
    <AstryxBadge
      variant={astryxVariant}
      label={children}
      className={className}
      {...(props as any)}
    />
  );
}

export { Badge };
