"use client";

import * as React from "react";
import { TextInput as AstryxTextInput } from "@astryxdesign/core/TextInput";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type = "text", value, defaultValue, onChange, ...props }, ref) => {
    // Check if type is controlled/uncontrolled and convert value accordingly
    const [localValue, setLocalValue] = React.useState(defaultValue ?? "");
    const isControlled = value !== undefined;
    const currentVal = isControlled ? String(value) : String(localValue);

    const handleChange = (val: string, e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setLocalValue(e.target.value);
      }
      onChange?.(e);
    };

    // Astryx TextInput only supports 'text' | 'password' | 'email' prop-types
    if (type === "text" || type === "password" || type === "email") {
      return (
        <AstryxTextInput
          ref={ref as any}
          type={type}
          label=""
          isLabelHidden
          value={currentVal}
          onChange={handleChange}
          className={className}
          isDisabled={props.disabled}
          placeholder={props.placeholder}
          {...(props as any)}
        />
      );
    }

    // Fallback to standard input with Astryx text input styling classes for other types
    return (
      <input
        ref={ref}
        type={type}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        className={cn(
          "astryx-text-input h-10 w-full min-w-0 rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
