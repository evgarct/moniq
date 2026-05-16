import { Ellipsis, PencilLine, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { CategoryIcon } from "@/components/category-icon";
import { MoneyAmount } from "@/components/money-amount";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CategoryTreeNode } from "@/types/finance";

function CategoryTreeRow({
  node,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: CategoryTreeNode;
  onAddChild: (node: CategoryTreeNode) => void;
  onEdit: (node: CategoryTreeNode) => void;
  onDelete: (node: CategoryTreeNode) => void;
}) {
  const t = useTranslations("categories.tree");
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3 rounded-[var(--radius-control)] px-2 py-2.5 transition-colors hover:bg-secondary/50">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-muted-foreground"
            style={{ marginLeft: `${node.depth * 16}px` }}
          >
            <CategoryIcon icon={node.icon} className="size-full" glyphClassName="text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="type-body-14 truncate font-medium text-foreground">{node.name}</p>
            <p className="type-body-12 text-muted-foreground">{t("childrenCount", { count: node.children.length })}</p>
          </div>
        </div>

        <div className="space-y-0.5 text-right">
          {node.totals_by_currency.length ? (
            node.totals_by_currency.map((total) => (
              <MoneyAmount
                key={total.currency}
                amount={total.amount}
                currency={total.currency}
                display="absolute"
                className="block text-sm font-semibold text-foreground"
              />
            ))
          ) : (
            <span className="type-body-12 text-muted-foreground">{t("noSpendYet")}</span>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:bg-secondary/50 hover:text-foreground" />
            }
          >
            <Ellipsis className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44 p-1.5">
            <DropdownMenuItem className="px-2 py-2 text-[13px]" onClick={() => onAddChild(node)}>
              <Plus className="h-4 w-4" />
              {t("addChild")}
            </DropdownMenuItem>
            <DropdownMenuItem className="px-2 py-2 text-[13px]" onClick={() => onEdit(node)}>
              <PencilLine className="h-4 w-4" />
              {t("editCategory")}
            </DropdownMenuItem>
            <DropdownMenuItem className="px-2 py-2 text-[13px]" variant="destructive" onClick={() => onDelete(node)}>
              <Trash2 className="h-4 w-4" />
              {t("deleteCategory")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {node.children.length ? (
        <div className={cn("space-y-1.5 border-l border-dashed border-border/70 pl-3")}>
          {node.children.map((child) => (
            <CategoryTreeRow key={child.id} node={child} onAddChild={onAddChild} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CategoryTree({
  nodes,
  onAddChild,
  onEdit,
  onDelete,
}: {
  nodes: CategoryTreeNode[];
  onAddChild: (node: CategoryTreeNode) => void;
  onEdit: (node: CategoryTreeNode) => void;
  onDelete: (node: CategoryTreeNode) => void;
}) {
  return (
    <div className="space-y-3">
      {nodes.map((node) => (
        <CategoryTreeRow key={node.id} node={node} onAddChild={onAddChild} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
