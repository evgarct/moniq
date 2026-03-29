import { Ellipsis, PencilLine, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

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
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="h-8 w-8 shrink-0 rounded-xl border border-black/5 bg-slate-50 text-center text-base leading-8"
            style={{ marginLeft: `${node.depth * 16}px` }}
          >
            {node.icon ?? "📁"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{node.name}</p>
            <p className="text-xs text-slate-500">{t("childrenCount", { count: node.children.length })}</p>
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
                className="block text-sm font-semibold text-slate-900"
              />
            ))
          ) : (
            <span className="text-xs text-slate-400">{t("noSpendYet")}</span>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" />
            }
          >
            <Ellipsis className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44 rounded-xl bg-white p-1.5">
            <DropdownMenuItem className="rounded-lg px-2 py-2 text-[13px]" onClick={() => onAddChild(node)}>
              <Plus className="h-4 w-4" />
              {t("addChild")}
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-lg px-2 py-2 text-[13px]" onClick={() => onEdit(node)}>
              <PencilLine className="h-4 w-4" />
              {t("editCategory")}
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-lg px-2 py-2 text-[13px]" variant="destructive" onClick={() => onDelete(node)}>
              <Trash2 className="h-4 w-4" />
              {t("deleteCategory")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {node.children.length ? (
        <div className={cn("space-y-2 border-l border-dashed border-slate-200 pl-3")}>
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
