"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type FieldErrorLike = {
  message?: string;
};

type FormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  submitLabel: React.ReactNode;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  children: React.ReactNode;
  side?: React.ComponentProps<typeof SheetContent>["side"];
  contentClassName?: string;
  formClassName?: string;
  footer?: React.ReactNode;
};

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  onSubmit,
  children,
  side = "right",
  contentClassName,
  formClassName,
  footer,
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={cn("w-full sm:max-w-md", contentClassName)}>
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>

        <form className={cn("flex flex-1 flex-col", formClassName)} onSubmit={onSubmit}>
          {children}
          {footer ?? <FormSheetFooter submitLabel={submitLabel} />}
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function FormSheetBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <FieldGroup className={cn("flex-1 gap-5 overflow-y-auto p-4", className)}>
      {children}
    </FieldGroup>
  );
}

export function FormSheetFooter({
  submitLabel,
  children,
  className,
}: {
  submitLabel: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <SheetFooter className={cn("border-t", className)}>
      {children ?? (
        <Button type="submit" className="w-full">
          {submitLabel}
        </Button>
      )}
    </SheetFooter>
  );
}

export function FormField({
  id,
  label,
  error,
  children,
  className,
}: {
  id?: string;
  label: React.ReactNode;
  error?: FieldErrorLike;
  children: React.ReactNode;
  className?: string;
}) {
  const invalid = Boolean(error?.message);

  return (
    <Field data-invalid={invalid} className={className}>
      {id ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : <FieldTitle>{label}</FieldTitle>}
      {children}
      <FieldError errors={error ? [error] : undefined} />
    </Field>
  );
}

export function FormSelectField({
  id,
  label,
  error,
  value,
  onValueChange,
  children,
  placeholder,
  triggerClassName,
  className,
}: {
  id?: string;
  label: React.ReactNode;
  error?: FieldErrorLike;
  value?: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  triggerClassName?: string;
  className?: string;
}) {
  return (
    <FormField id={id} label={label} error={error} className={className}>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue !== null) {
            onValueChange(nextValue);
          }
        }}
      >
        <SelectTrigger
          id={id}
          aria-invalid={Boolean(error?.message)}
          className={cn("w-full bg-background", triggerClassName)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </FormField>
  );
}
