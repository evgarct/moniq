"use client";

import * as React from "react";
import { Skeleton as AstryxSkeleton } from "@astryxdesign/core/Skeleton";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  index?: number;
}

function Skeleton({ className, index = 0, ...props }: SkeletonProps) {
  // Astryx Skeleton accepts index, width, height, radius
  // If className has width/height classes, standard CSS classes on className will take effect
  // Let's pass className and index, letting the styles override correctly
  return (
    <div className={className} {...props}>
      <AstryxSkeleton index={index} radius={3} />
    </div>
  );
}

export { Skeleton };
