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
        outline: "border-border bg-background hover:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2 lg:h-10",
        sm: "h-11 px-3 lg:h-10",
        lg: "h-11 px-5",
        icon: "size-11 lg:size-10",
        "icon-sm": "size-11 lg:size-10",
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

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", children, static: isStatic, ...props }, ref) => {
    // Map variant string to Astryx variant
    let astryxVariant: "primary" | "secondary" | "ghost" | "destructive" = "secondary";
    if (variant === "default") {
      astryxVariant = "primary";
    } else if (variant === "outline" || variant === "secondary") {
      astryxVariant = "secondary";
    } else if (variant === "ghost" || variant === "link") {
      astryxVariant = "ghost";
    }

    // Map size string to Astryx size
    let astryxSize: "sm" | "md" | "lg" = "md";
    if (size === "sm") {
      astryxSize = "sm";
    } else if (size === "lg") {
      astryxSize = "lg";
    }

    // Derive label for accessibility (required by Astryx)
    let label = "";
    if (typeof children === "string") {
      label = children;
    } else if (props["aria-label"]) {
      label = props["aria-label"];
    } else {
      label = "action";
    }

    const isIcon = size === "icon" || size === "icon-sm";

    if (isIcon) {
      return (
        <AstryxIconButton
          ref={ref as any}
          label={label}
          size={astryxSize}
          variant={astryxVariant}
          className={cn(className, variant === "link" && "underline")}
          isDisabled={props.disabled}
          onClick={props.onClick as any}
          icon={children}
          {...(props as any)}
        />
      );
    }

    return (
      <AstryxButton
        ref={ref as any}
        label={label}
        size={astryxSize}
        variant={astryxVariant}
        className={cn(className, variant === "link" && "underline")}
        isDisabled={props.disabled}
        onClick={props.onClick as any}
        {...(props as any)}
      >
        {children}
      </AstryxButton>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
