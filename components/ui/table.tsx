"use client";

import * as React from "react";
import {
  TableHeader as AstryxTableHeader,
  TableBody as AstryxTableBody,
  TableFooter as AstryxTableFooter,
  TableRow as AstryxTableRow,
  TableCell as AstryxTableCell,
  TableHeaderCell as AstryxTableHeaderCell,
} from "@astryxdesign/core/Table";
import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
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

function TableHeader({ className, children, ...props }: React.ComponentProps<"thead">) {
  return (
    <AstryxTableHeader
      data-slot="table-header"
      className={cn("[&_tr]:border-b border-border", className)}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </AstryxTableHeader>
  );
}

function TableBody({ className, children, ...props }: React.ComponentProps<"tbody">) {
  return (
    <AstryxTableBody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </AstryxTableBody>
  );
}

function TableFooter({ className, children, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <AstryxTableFooter
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </AstryxTableFooter>
  );
}

function TableRow({ className, children, ...props }: React.ComponentProps<"tr">) {
  return (
    <AstryxTableRow
      data-slot="table-row"
      className={cn(
        "border-b border-border transition-colors hover:bg-secondary/50 data-[state=selected]:bg-secondary/50",
        className
      )}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </AstryxTableRow>
  );
}

function TableHead({ className, children, ...props }: React.ComponentProps<"th">) {
  return (
    <AstryxTableHeaderCell
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </AstryxTableHeaderCell>
  );
}

function TableCell({ className, children, ...props }: React.ComponentProps<"td">) {
  return (
    <AstryxTableCell
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </AstryxTableCell>
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
