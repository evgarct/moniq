"use client";

import * as React from "react";
import { Switch as AstryxSwitch } from "@astryxdesign/core/Switch";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

function Switch({
  checked = false,
  onCheckedChange,
  disabled = false,
  className,
  id,
  ...props
}: SwitchProps) {
  return (
    <div className={className}>
      <AstryxSwitch
        id={id}
        value={checked}
        onChange={(val) => onCheckedChange?.(val)}
        isDisabled={disabled}
        label=""
        isLabelHidden
        {...props}
      />
    </div>
  );
}

export { Switch };
