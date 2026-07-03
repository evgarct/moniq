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

function extractIconFromChildren(children: React.ReactNode): {
  icon?: React.ReactNode;
  content: React.ReactNode;
} {
  const childrenArray = React.Children.toArray(children);
  if (childrenArray.length === 0) {
    return { content: children };
  }

  let icon: React.ReactNode | undefined;
  let startIdx = 0;

  const firstChild = childrenArray[0];
  if (React.isValidElement(firstChild) && typeof firstChild.type !== "string") {
    icon = firstChild;
    startIdx = 1;
  }

  const content = childrenArray.slice(startIdx);
  return {
    icon,
    content: content.length === 1 ? content[0] : content.length === 0 ? undefined : content,
  };
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
  const { icon: extractedIcon, content: remainingContent } = extractIconFromChildren(children);

  let labelStr = "";
  if (typeof remainingContent === "string") {
    labelStr = remainingContent;
  } else if (ariaLabel) {
    labelStr = ariaLabel;
  } else {
    labelStr = value;
  }

  const astryxProps = { ...props };
  delete (astryxProps as Record<string, unknown>).variant;
  delete (astryxProps as Record<string, unknown>).size;

  return (
    <AstryxSegmentedControlItem
      value={value}
      label={labelStr}
      icon={extractedIcon}
      isDisabled={disabled}
      className={className}
      {...(astryxProps as Record<string, unknown>)}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
