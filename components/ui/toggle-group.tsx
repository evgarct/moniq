"use client";

import * as React from "react";
import {
  SegmentedControl as AstryxSegmentedControl,
  SegmentedControlItem as AstryxSegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import { type VariantProps } from "class-variance-authority";
import { toggleVariants } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

const ToggleGroupContext = React.createContext<{
  value?: string;
  onChange?: (value: string) => void;
}>({});

export interface ToggleGroupProps extends VariantProps<typeof toggleVariants> {
  className?: string;
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  orientation?: "horizontal" | "vertical";
  children?: React.ReactNode;
  disabled?: boolean;
  spacing?: number;
}

function ToggleGroup({
  className,
  value,
  onValueChange,
  children,
  disabled,
  size,
  ...props
}: ToggleGroupProps) {
  const isArray = Array.isArray(value);
  const scalarValue = isArray ? (value as string[])[0] || "" : (value as string || "");

  const handleChange = (nextValue: string) => {
    if (onValueChange) {
      if (isArray) {
        onValueChange([nextValue]);
      } else {
        onValueChange(nextValue);
      }
    }
  };

  // Map size to Astryx size ('sm' | 'md' | 'lg')
  let astryxSize: "sm" | "md" | "lg" = "md";
  if (size === "sm") {
    astryxSize = "sm";
  } else if (size === "lg") {
    astryxSize = "lg";
  }

  const astryxProps = { ...props };
  delete (astryxProps as Record<string, unknown>).variant;
  delete (astryxProps as Record<string, unknown>).spacing;
  delete (astryxProps as Record<string, unknown>).orientation;

  return (
    <ToggleGroupContext.Provider value={{ value: scalarValue, onChange: handleChange }}>
      <AstryxSegmentedControl
        value={scalarValue}
        onChange={handleChange}
        label="Toggle Group"
        isDisabled={disabled}
        size={astryxSize}
        className={cn("w-fit", className)}
        {...(astryxProps as Record<string, unknown>)}
      >
        {children}
      </AstryxSegmentedControl>
    </ToggleGroupContext.Provider>
  );
}

export interface ToggleGroupItemProps extends VariantProps<typeof toggleVariants> {
  className?: string;
  value: string;
  children?: React.ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
}

function ToggleGroupItem({
  className,
  value,
  children,
  disabled,
  "aria-label": ariaLabel,
  ...props
}: ToggleGroupItemProps) {
  // Derive label for accessibility (required by Astryx SegmentedControlItem)
  let label = "";
  if (typeof children === "string") {
    label = children;
  } else if (ariaLabel) {
    label = ariaLabel;
  } else {
    label = value;
  }

  const astryxProps = { ...props };
  delete (astryxProps as Record<string, unknown>).variant;
  delete (astryxProps as Record<string, unknown>).size;

  return (
    <AstryxSegmentedControlItem
      value={value}
      label={label}
      isDisabled={disabled}
      className={className}
      {...(astryxProps as Record<string, unknown>)}
    >
      {children}
    </AstryxSegmentedControlItem>
  );
}

export { ToggleGroup, ToggleGroupItem };
