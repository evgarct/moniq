"use client";

import * as React from "react";
import { Avatar as AstryxAvatar } from "@astryxdesign/core/Avatar";
import {
  AvatarGroup as AstryxAvatarGroup,
  AvatarGroupOverflow as AstryxAvatarGroupOverflow,
} from "@astryxdesign/core/AvatarGroup";
import { cn } from "@/lib/utils";

export interface AvatarProps {
  className?: string;
  src?: string;
  alt?: string;
  name?: string;
  size?: "default" | "sm" | "lg";
  status?: React.ReactNode;
}

function Avatar({
  className,
  src,
  alt,
  name,
  size = "default",
  status,
  ...props
}: AvatarProps) {
  let astryxSize: "small" | "medium" | "large" = "medium";
  if (size === "sm") {
    astryxSize = "small";
  } else if (size === "lg") {
    astryxSize = "large";
  }

  return (
    <AstryxAvatar
      src={src}
      alt={alt}
      name={name}
      size={astryxSize}
      status={status}
      className={cn("select-none", className)}
      {...(props as any)}
    />
  );
}

function AvatarImage({ className, ...props }: any) {
  return null;
}

function AvatarFallback({ className, ...props }: any) {
  return null;
}

function AvatarBadge({ className, ...props }: any) {
  return null;
}

export interface AvatarGroupProps {
  className?: string;
  size?: "default" | "sm" | "lg";
  children?: React.ReactNode;
}

function AvatarGroup({
  className,
  size = "default",
  children,
  ...props
}: AvatarGroupProps) {
  let astryxSize: "small" | "medium" | "large" = "medium";
  if (size === "sm") {
    astryxSize = "small";
  } else if (size === "lg") {
    astryxSize = "large";
  }

  return (
    <AstryxAvatarGroup
      size={astryxSize}
      className={className}
      {...(props as any)}
    >
      {children}
    </AstryxAvatarGroup>
  );
}

export interface AvatarGroupCountProps {
  className?: string;
  count: number;
  onClick?: () => void;
}

function AvatarGroupCount({
  className,
  count,
  onClick,
  ...props
}: AvatarGroupCountProps) {
  return (
    <AstryxAvatarGroupOverflow
      count={count}
      onClick={onClick}
      className={className}
      {...(props as any)}
    />
  );
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
};
