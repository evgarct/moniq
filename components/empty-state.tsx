import React from "react";
import { ZeroState, type ZeroStateIllustrationType } from "./zero-state";

export function EmptyState({
  title,
  description,
  action,
  className,
  illustration = "default",
}: {
  title: React.ReactNode;
  description: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  illustration?: ZeroStateIllustrationType | React.ReactNode;
}) {
  return (
    <ZeroState
      illustration={illustration}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}
export { ZeroState };
