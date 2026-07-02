import { cn } from "@/lib/utils";
import React from "react";

export type ZeroStateIllustrationType =
  | "wallet"
  | "transactions"
  | "budget"
  | "calendar"
  | "inbox"
  | "reports"
  | "search"
  | "default";

interface ZeroStateProps {
  illustration?: ZeroStateIllustrationType | React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

function ZeroIllustration({ type }: { type: ZeroStateIllustrationType }) {
  switch (type) {
    case "wallet":
      return (
        <svg
          width="128"
          height="128"
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto text-muted-foreground"
        >
          <circle
            cx="64"
            cy="64"
            r="48"
            fill="#f0d6b5"
            fillOpacity="0.15"
            stroke="#f0d6b5"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <path
            d="M68 52V40c0-2.5 1.5-4 4-4h14c2.5 0 4 1.5 4 4v12"
            stroke="#cc785c"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <rect
            x="36"
            y="52"
            width="56"
            height="38"
            rx="6"
            stroke="#40403e"
            strokeWidth="1.75"
            fill="#fafaf7"
          />
          <path
            d="M58 70h34v8c0 3-2.5 5-5 5H58V70z"
            stroke="#40403e"
            strokeWidth="1.75"
            fill="#f0f0eb"
          />
          <circle cx="82" cy="77" r="2.5" fill="#cc785c" />
        </svg>
      );
    case "transactions":
      return (
        <svg
          width="128"
          height="128"
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto text-muted-foreground"
        >
          <circle
            cx="64"
            cy="64"
            r="48"
            fill="#a3b19b"
            fillOpacity="0.15"
            stroke="#a3b19b"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <rect
            x="40"
            y="32"
            width="48"
            height="64"
            rx="4"
            stroke="#40403e"
            strokeWidth="1.75"
            fill="#fafaf7"
          />
          <path
            d="M52 48h24M52 58h24M52 68h24"
            stroke="#e5e4df"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="52" cy="78" r="3" stroke="#40403e" strokeWidth="1.5" fill="none" />
          <path d="M60 78h16" stroke="#e5e4df" strokeWidth="1.75" strokeLinecap="round" />
          <path
            d="M96 28l2.5 5 5 2.5-5 2.5-2.5 5-2.5-5-5-2.5 5-2.5z"
            fill="#cc785c"
          />
        </svg>
      );
    case "budget":
      return (
        <svg
          width="128"
          height="128"
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto text-muted-foreground"
        >
          <circle
            cx="64"
            cy="64"
            r="48"
            fill="#cc785c"
            fillOpacity="0.1"
            stroke="#cc785c"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <path
            d="M48 82h32l-4 18H52z"
            stroke="#40403e"
            strokeWidth="1.75"
            fill="#fafaf7"
          />
          <path
            d="M64 82V48"
            stroke="#40403e"
            strokeWidth="1.75"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M64 68c-6-2-12-8-12-14 0 0 6 2 12 6"
            stroke="#40403e"
            strokeWidth="1.75"
            strokeLinecap="round"
            fill="#a3b19b"
            fillOpacity="0.8"
          />
          <path
            d="M64 58c6-2 12-8 12-14 0 0-6 2-12 6"
            stroke="#40403e"
            strokeWidth="1.75"
            strokeLinecap="round"
            fill="#a3b19b"
            fillOpacity="0.8"
          />
          <circle cx="64" cy="42" r="4.5" fill="#cc785c" />
        </svg>
      );
    case "calendar":
      return (
        <svg
          width="128"
          height="128"
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto text-muted-foreground"
        >
          <circle
            cx="64"
            cy="64"
            r="48"
            fill="#8c9fa3"
            fillOpacity="0.15"
            stroke="#8c9fa3"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <rect
            x="36"
            y="38"
            width="56"
            height="52"
            rx="6"
            stroke="#40403e"
            strokeWidth="1.75"
            fill="#fafaf7"
          />
          <path d="M36 50h56" stroke="#40403e" strokeWidth="1.75" />
          <path
            d="M48 34v8M80 34v8"
            stroke="#cc785c"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="48" cy="60" r="2.5" fill="#e5e4df" />
          <circle cx="64" cy="60" r="2.5" fill="#e5e4df" />
          <circle cx="80" cy="60" r="2.5" fill="#e5e4df" />
          <circle cx="48" cy="72" r="2.5" fill="#e5e4df" />
          <circle cx="64" cy="72" r="3.5" fill="#cc785c" />
          <circle cx="80" cy="72" r="2.5" fill="#e5e4df" />
          <circle cx="48" cy="82" r="2.5" fill="#e5e4df" />
          <circle cx="64" cy="82" r="2.5" fill="#e5e4df" />
          <circle cx="80" cy="82" r="2.5" fill="#e5e4df" />
        </svg>
      );
    case "inbox":
      return (
        <svg
          width="128"
          height="128"
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto text-muted-foreground"
        >
          <circle
            cx="64"
            cy="64"
            r="48"
            fill="#f0d6b5"
            fillOpacity="0.15"
            stroke="#f0d6b5"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <rect
            x="34"
            y="44"
            width="60"
            height="42"
            rx="4"
            stroke="#40403e"
            strokeWidth="1.75"
            fill="#fafaf7"
          />
          <path
            d="M34 46l30 22 30-22"
            stroke="#40403e"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M44 32h16m-16 6h10"
            stroke="#e5e4df"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="82" cy="32" r="4" fill="#cc785c" />
        </svg>
      );
    case "reports":
      return (
        <svg
          width="128"
          height="128"
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto text-muted-foreground"
        >
          <circle
            cx="64"
            cy="64"
            r="48"
            fill="#8c9fa3"
            fillOpacity="0.15"
            stroke="#8c9fa3"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <rect
            x="36"
            y="36"
            width="56"
            height="56"
            rx="4"
            stroke="#40403e"
            strokeWidth="1.75"
            fill="#fafaf7"
          />
          <path
            d="M44 76l10-16 14 10 16-24"
            stroke="#cc785c"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="44" cy="76" r="3" fill="#40403e" />
          <circle cx="54" cy="60" r="3" fill="#40403e" />
          <circle cx="68" cy="70" r="3" fill="#40403e" />
          <circle cx="84" cy="46" r="3" fill="#cc785c" />
        </svg>
      );
    case "search":
      return (
        <svg
          width="128"
          height="128"
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto text-muted-foreground"
        >
          <circle
            cx="64"
            cy="64"
            r="48"
            fill="#f0d6b5"
            fillOpacity="0.15"
            stroke="#f0d6b5"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <circle cx="58" cy="58" r="16" stroke="#40403e" strokeWidth="1.75" fill="none" />
          <path
            d="M70 70l18 18"
            stroke="#40403e"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="46" cy="46" r="2.5" fill="#cc785c" />
          <path
            d="M84 46l2 3 3 2-3 2-2 3-2-3-3-2 3-2z"
            fill="#a3b19b"
          />
        </svg>
      );
    case "default":
    default:
      return (
        <svg
          width="128"
          height="128"
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto text-muted-foreground"
        >
          <circle
            cx="64"
            cy="64"
            r="48"
            fill="#e5e4df"
            fillOpacity="0.15"
            stroke="#e5e4df"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <circle
            cx="54"
            cy="60"
            r="20"
            fill="#a3b19b"
            fillOpacity="0.25"
            stroke="#a3b19b"
            strokeWidth="1.25"
          />
          <path
            d="M58 46c10 0 18 8 18 18s-8 18-18 18"
            fill="#f0d6b5"
            fillOpacity="0.4"
            stroke="#f0d6b5"
            strokeWidth="1.25"
          />
          <path
            d="M78 46l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"
            fill="#cc785c"
          />
          <rect
            x="42"
            y="42"
            width="44"
            height="44"
            rx="6"
            stroke="#40403e"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            fill="none"
          />
        </svg>
      );
  }
}

export function ZeroState({
  illustration,
  title,
  description,
  action,
  className,
}: ZeroStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-12 w-full min-h-[350px] h-full transition-all duration-300 animate-in fade-in slide-in-from-bottom-2",
        className
      )}
    >
      {illustration ? (
        <div className="mb-6 flex justify-center shrink-0">
          {typeof illustration === "string" ? (
            <ZeroIllustration type={illustration as ZeroStateIllustrationType} />
          ) : (
            illustration
          )}
        </div>
      ) : null}

      {title ? (
        <h3 className="type-h6 font-medium text-foreground max-w-md balance leading-snug">
          {title}
        </h3>
      ) : null}

      {description ? (
        <p className="mt-2 type-body-14 text-muted-foreground max-w-sm balance">
          {description}
        </p>
      ) : null}

      {action ? (
        <div className="mt-6 flex items-center justify-center gap-3 shrink-0">
          {action}
        </div>
      ) : null}
    </div>
  );
}
