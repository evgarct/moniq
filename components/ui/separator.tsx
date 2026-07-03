"use client";

import * as React from "react";
import { Divider as AstryxDivider } from "@astryxdesign/core/Divider";
import { cn } from "@/lib/utils";

interface SeparatorProps {
  className?: string;
  orientation?: "horizontal" | "vertical";
}

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorProps) {
  return (
    <AstryxDivider
      orientation={orientation}
      className={className}
      {...props}
    />
  );
}

export { Separator };
