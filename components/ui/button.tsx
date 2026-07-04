"use client";

import * as React from "react";
import { Button as AstryxButton } from "@astryxdesign/core/Button";
import { IconButton as AstryxIconButton } from "@astryxdesign/core/IconButton";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-transparent text-sm font-medium whitespace-nowrap transition-[scale,background-color,color,border-color,box-shadow] outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border-border bg-background hover:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2 lg:h-10",
        sm: "h-11 px-3 lg:h-10",
        lg: "h-11 px-5",
        icon: "size-11 lg:size-10 p-0",
        "icon-sm": "size-11 lg:size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  static?: boolean;
}

function isIconElement(children: React.ReactNode): boolean {
  const childrenArray = React.Children.toArray(children);
  if (childrenArray.length !== 1) {
    return false;
  }
  const child = childrenArray[0];
  if (!React.isValidElement(child)) {
    return false;
  }
  return typeof child.type !== "string";
}

function extractIconFromChildren(children: React.ReactNode): {
  icon?: React.ReactNode;
  endContent?: React.ReactNode;
  content: React.ReactNode;
} {
  const childrenArray = React.Children.toArray(children);
  if (childrenArray.length === 0) {
    return { content: children };
  }

  let icon: React.ReactNode | undefined;
  let endContent: React.ReactNode | undefined;
  let startIdx = 0;
  let endIdx = childrenArray.length;

  const firstChild = childrenArray[0];
  if (React.isValidElement(firstChild) && typeof firstChild.type !== "string") {
    icon = firstChild;
    startIdx = 1;
  }

  if (endIdx > startIdx + 1) {
    const lastChild = childrenArray[endIdx - 1];
    if (React.isValidElement(lastChild) && typeof lastChild.type !== "string") {
      endContent = lastChild;
      endIdx = endIdx - 1;
    }
  }

  const content = childrenArray.slice(startIdx, endIdx);

  return {
    icon,
    endContent,
    content: content.length === 1 ? content[0] : content.length === 0 ? undefined : content,
  };
}

function extractTextFromChildren(children: React.ReactNode): string {
  let text = "";
  React.Children.forEach(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      text += child;
    } else if (React.isValidElement(child) && child.props && (child.props as Record<string, unknown>).children) {
      text += extractTextFromChildren((child.props as Record<string, unknown>).children as React.ReactNode);
    }
  });
  return text.trim();
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", children, ...props }, ref) => {
    let astryxVariant: "primary" | "secondary" | "ghost" | "destructive" = "secondary";
    if (variant === "default") {
      astryxVariant = "primary";
    } else if (variant === "outline" || variant === "secondary") {
      astryxVariant = "secondary";
    } else if (variant === "ghost" || variant === "link") {
      astryxVariant = "ghost";
    }

    let astryxSize: "sm" | "md" | "lg" = "md";
    if (size === "sm") {
      astryxSize = "sm";
    } else if (size === "lg") {
      astryxSize = "lg";
    }

    const textLabel = extractTextFromChildren(children);
    let label = "";
    if (props["aria-label"]) {
      label = props["aria-label"];
    } else if (textLabel) {
      label = textLabel;
    } else {
      label = "action";
    }

    const isIcon = (size === "icon" || size === "icon-sm") && isIconElement(children);

    const astryxProps = { ...props };
    delete (astryxProps as Record<string, unknown>).static;

    if (isIcon) {
      return (
        <AstryxIconButton
          ref={ref as unknown as React.Ref<HTMLButtonElement>}
          label={label}
          size={astryxSize}
          variant={astryxVariant}
          className={cn(buttonVariants({ variant, size }), className)}
          isDisabled={props.disabled}
          onClick={props.onClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
          icon={children}
          {...(astryxProps as Record<string, unknown>)}
        />
      );
    }

    const { icon: extractedIcon, endContent: extractedEndContent, content: remainingContent } = extractIconFromChildren(children);

    return (
      <AstryxButton
        ref={ref as unknown as React.Ref<HTMLButtonElement>}
        label={label}
        size={astryxSize}
        variant={astryxVariant}
        icon={extractedIcon}
        endContent={extractedEndContent}
        className={cn(buttonVariants({ variant, size }), className)}
        isDisabled={props.disabled}
        onClick={props.onClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
        {...(astryxProps as Record<string, unknown>)}
      >
        {remainingContent}
      </AstryxButton>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
