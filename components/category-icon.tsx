import type { LucideIcon } from "lucide-react";
import {
  Apple,
  BanknoteArrowUp,
  Bed,
  Bot,
  BriefcaseBusiness,
  FileText,
  BusFront,
  Car,
  CircleDollarSign,
  Dumbbell,
  Building2,
  Ellipsis,
  Folder,
  Gift,
  Heart,
  House,
  Languages,
  Landmark,
  Luggage,
  Music4,
  Package,
  PartyPopper,
  PawPrint,
  Plane,
  Receipt,
  RotateCcw,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Stethoscope,
  Shirt,
  Ticket,
  Trophy,
  TrendingUp,
  Tv,
  UtensilsCrossed,
  Wallet,
  LaptopMinimal,
} from "lucide-react";

import { cn } from "@/lib/utils";

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  "banknote-arrow-up": BanknoteArrowUp,
  "briefcase-business": BriefcaseBusiness,
  "building-2": Building2,
  "rotate-ccw": RotateCcw,
  receipt: Receipt,
  house: House,
  "circle-dollar-sign": CircleDollarSign,
  heart: Heart,
  shield: Shield,
  wallet: Wallet,
  "shopping-cart": ShoppingCart,
  sparkles: Sparkles,
  "paw-print": PawPrint,
  stethoscope: Stethoscope,
  smartphone: Smartphone,
  "file-text": FileText,
  "bus-front": BusFront,
  "party-popper": PartyPopper,
  "utensils-crossed": UtensilsCrossed,
  languages: Languages,
  ticket: Ticket,
  package: Package,
  repeat: RotateCcw,
  laptop: LaptopMinimal,
  dumbbell: Dumbbell,
  trophy: Trophy,
  "music-4": Music4,
  tv: Tv,
  bot: Bot,
  car: Car,
  plane: Plane,
  bed: Bed,
  luggage: Luggage,
  apple: Apple,
  shirt: Shirt,
  "shopping-bag": ShoppingBag,
  "trending-up": TrendingUp,
  gift: Gift,
  landmark: Landmark,
  ellipsis: Ellipsis,
  folder: Folder,
};

export function CategoryIcon({
  icon,
  className,
  glyphClassName,
}: {
  icon: string | null | undefined;
  className?: string;
  glyphClassName?: string;
}) {
  const token = icon?.trim().toLowerCase() ?? "";
  const IconComponent = CATEGORY_ICON_MAP[token] ?? null;

  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", className)}>
      {IconComponent ? (
        <IconComponent className={cn("size-4", glyphClassName)} strokeWidth={1.8} />
      ) : token ? (
        <span className={cn("text-base leading-none", glyphClassName)}>{icon}</span>
      ) : (
        <Folder className={cn("size-4", glyphClassName)} strokeWidth={1.8} />
      )}
    </span>
  );
}
