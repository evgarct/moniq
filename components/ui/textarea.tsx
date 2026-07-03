"use client";

import * as React from "react";
import { TextArea as AstryxTextArea } from "@astryxdesign/core/TextArea";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, value, defaultValue, onChange, ...props }, ref) => {
    const [localValue, setLocalValue] = React.useState(defaultValue ?? "");
    const isControlled = value !== undefined;
    const currentVal = isControlled ? String(value) : String(localValue);

    const handleChange = (val: string, e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!isControlled) {
        setLocalValue(e.target.value);
      }
      onChange?.(e);
    };

    return (
      <AstryxTextArea
        ref={ref as unknown as React.Ref<HTMLTextAreaElement>}
        label=""
        isLabelHidden
        value={currentVal}
        onChange={handleChange}
        className={className}
        isDisabled={props.disabled}
        placeholder={props.placeholder}
        {...(props as Record<string, unknown>)}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
