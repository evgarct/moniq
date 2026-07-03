"use client"

import * as React from "react"
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput"
import { cn } from "@/lib/utils"

export interface CheckboxProps {
  checked?: boolean | "indeterminate"
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  id?: string
  name?: string
  value?: string
  required?: boolean
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, onCheckedChange, disabled, className, ...props }, ref) => {
    const val = checked === "indeterminate" ? "indeterminate" : !!checked;
    return (
      <CheckboxInput
        ref={ref}
        value={val}
        onChange={(isChecked) => onCheckedChange?.(isChecked)}
        isDisabled={disabled}
        label=""
        isLabelHidden
        className={cn("size-4", className)}
        {...(props as Record<string, unknown>)}
      />
    );
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
