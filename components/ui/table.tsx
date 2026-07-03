"use client";

import * as React from "react";
import { TableHeader as AstryxTableHeader } from "@astryxdesign/core/TableHeader";
import { TableBody as AstryxTableBody } from "@astryxdesign/core/TableBody";
import { TableFooter as AstryxTableFooter } from "@astryxdesign/core/TableFooter";
import { TableRow as AstryxTableRow } from "@astryxdesign/core/TableRow";
import { TableCell as AstryxTableCell } from "@astryxdesign/core/TableCell";
import { TableHeaderCell as AstryxTableHeaderCell } from "@astryxdesign/core/TableHeaderCell";
import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  // Astryx Table wraps layout scroll styles and maps children
  return (
    <div className="relative w-full overflow-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm border-collapse", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <AstryxTableHeader
      data-slot="table-header"
      className={cn("[&_tr]:border-b border-border", className)}
      {...(props as Record<string, unknown>)}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <AstryxTableBody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...(props as Record<string, unknown>)}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <AstryxTableFooter
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...(props as Record<string, unknown>)}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <AstryxTableRow
      data-slot="table-row"
      className={cn(
        "border-b border-border transition-colors hover:bg-secondary/50 data-[state=selected]:bg-secondary/50",
        className
      )}
      {...(props as Record<string, unknown>)}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <AstryxTableHeaderCell
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...(props as Record<string, unknown>)}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <AstryxTableCell
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...(props as Record<string, unknown>)}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
};
