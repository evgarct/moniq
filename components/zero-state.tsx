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
          className="mx-auto"
        >
          <rect x="16" y="16" width="96" height="96" rx="24" fill="#cc785c" />
          <path
            d="M44 32 C54 31 66 33 76 32 C78 45 77 58 79 72 C77 82 78 92 76 100 C66 99 54 101 44 100 C42 85 43 72 42 58 C43 45 42 36 44 32 Z"
            fill="#fafaf7"
          />
          <path
            d="M48 46 C58 45 68 47 72 46"
            stroke="#191919"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M48 58 C58 57 68 59 72 58"
            stroke="#191919"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M48 70 C58 69 68 71 72 70"
            stroke="#191919"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="53" cy="46" r="3.5" fill="#191919" />
          <circle cx="60" cy="46" r="3.5" fill="#191919" />
          <circle cx="67" cy="46" r="3.5" fill="#191919" />

          <circle cx="53" cy="58" r="3.5" fill="#191919" />
          <circle cx="63" cy="58" r="3.5" fill="#191919" />
          <circle cx="70" cy="58" r="3.5" fill="#191919" />

          <circle cx="66" cy="70" r="3.5" fill="#191919" />
          <circle cx="73" cy="70" r="3.5" fill="#191919" />

          <path
            d="M26 80 C29 78 32 72 32 64 C32 54 34 50 36 50 C38 50 38 58 38 66 C38 54 40 48 42 48 C44 48 44 58 44 66 C44 54 46 50 48 50 C50 50 50 60 50 70 C50 64 53 60 56 60 C59 60 58 70 55 78 C53 83 49 87 49 92 C49 97 43 100 39 96 C33 91 30 84 26 80 Z"
            stroke="#191919"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
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
          className="mx-auto"
        >
          <rect x="16" y="16" width="96" height="96" rx="24" fill="#cc785c" />
          <path
            d="M44 60 C40 55 48 42 58 44 C63 36 78 36 83 44 C92 42 97 55 92 65 C94 72 84 78 78 76 C68 80 54 80 48 76 C42 75 42 65 44 60 Z"
            stroke="#191919"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M34 72 C30 68 37 58 44 60 C48 55 58 55 62 60 C70 58 74 68 70 75 C72 80 64 84 58 83 C50 85 40 85 36 82 C32 81 32 75 34 72 Z"
            fill="#fafaf7"
            stroke="#191919"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M46 88 L43 94 M58 88 L55 94 M70 85 L67 91"
            stroke="#fafaf7"
            strokeWidth="2"
            strokeLinecap="round"
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
          className="mx-auto"
        >
          <rect x="16" y="16" width="96" height="96" rx="24" fill="#cc785c" />
          <path
            d="M34 64 C39 64 42 67 42 72 C42 77 39 80 34 80 C29 80 26 77 26 72 C26 67 29 64 34 64 Z"
            fill="#fafaf7"
          />
          <path
            d="M44 78 C44 78 48 68 49 66 C48 64 44 54 44 54 L56 54 C56 54 52 64 51 66 C52 68 56 78 56 78 Z"
            fill="#fafaf7"
          />
          <path
            d="M62 78 L62 68 C62 62 74 62 74 68 L74 78 Z"
            fill="#fafaf7"
          />
          <path
            d="M62 48 H74 V60 H62 Z"
            fill="#fafaf7"
          />
          <path
            d="M68 28 C73 28 76 31 76 36 C76 41 73 44 68 44 C63 44 60 41 60 36 C60 31 63 28 68 28 Z"
            fill="#fafaf7"
          />
          <path
            d="M34 72 H50 V54 L68 72 V36"
            stroke="#191919"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="34" cy="72" r="3" fill="#191919" />
          <circle cx="50" cy="72" r="3" fill="#191919" />
          <circle cx="50" cy="54" r="3" fill="#191919" />
          <circle cx="68" cy="72" r="3" fill="#191919" />
          <circle cx="68" cy="54" r="3" fill="#191919" />
          <circle cx="68" cy="36" r="3" fill="#191919" />
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
          className="mx-auto"
        >
          <rect x="16" y="16" width="96" height="96" rx="24" fill="#cc785c" />
          <path
            d="M36 38 C48 37 64 39 82 38 C84 48 83 60 85 76 C71 77 55 75 41 76 C39 60 40 48 36 38 Z"
            fill="#fafaf7"
            stroke="#191919"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M44 32 C44 26 48 26 48 38 M58 32 C58 26 62 26 62 38 M72 32 C72 26 76 26 76 38"
            stroke="#191919"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M59 48 C59 48 55 44 51 44 C47 44 45 47 45 51 C45 56 50 60 59 66 C68 60 73 56 73 51 C73 47 71 44 67 44 C63 44 59 48 59 48 Z"
            fill="#cc785c"
            stroke="#191919"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M82 76 C88 74 94 76 96 82 C90 84 84 82 82 76 Z"
            fill="#fafaf7"
            stroke="#191919"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M82 76 L89 80"
            stroke="#191919"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
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
          className="mx-auto"
        >
          <rect x="16" y="16" width="96" height="96" rx="24" fill="#cc785c" />
          <path
            d="M64 48 V34 M64 34 C64 34 68 28 72 28 C72 34 66 34 64 34 M64 38 C64 38 60 32 56 32 C56 38 62 38 64 38"
            stroke="#191919"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M32 46 C48 44 64 44 80 46 C83 54 82 62 80 74 C64 76 48 76 32 74 C29 62 29 54 32 46 Z"
            fill="#fafaf7"
            stroke="#191919"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M32 46 L56 60 L80 46"
            stroke="#191919"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M34 72 L48 58 M78 72 L64 58"
            stroke="#191919"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
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
          className="mx-auto"
        >
          <rect x="16" y="16" width="96" height="96" rx="24" fill="#cc785c" />
          <path
            d="M34 82 V62 C38 61 40 63 44 62 V82 Z"
            fill="#fafaf7"
            stroke="#191919"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M50 82 V48 C54 47 56 49 60 48 V82 Z"
            fill="#fafaf7"
            stroke="#191919"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M66 82 V36 C70 35 72 37 76 36 V82 Z"
            fill="#fafaf7"
            stroke="#191919"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M39 56 L55 42 L71 30"
            stroke="#191919"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M71 20 L73 24 L78 24 L74 27 L76 31 L71 28 L66 31 L68 27 L64 24 L69 24 Z"
            fill="#fafaf7"
            stroke="#191919"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
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
          className="mx-auto"
        >
          <rect x="16" y="16" width="96" height="96" rx="24" fill="#cc785c" />
          <path
            d="M48 34 C58 34 66 42 66 52 C66 62 58 70 48 70 C38 70 30 62 30 52 C30 42 38 34 48 34 Z"
            fill="#fafaf7"
            stroke="#191919"
            strokeWidth="2"
          />
          <path
            d="M61 65 L78 82"
            stroke="#191919"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M48 42 C48 46 46 48 42 48 C46 48 48 50 48 54 C48 50 50 48 54 48 C50 48 48 46 48 42 Z"
            fill="#cc785c"
          />
          <path
            d="M72 40 C72 43 71 44 68 44 C71 44 72 45 72 48 C72 45 73 44 76 44 C73 44 72 43 72 40 Z"
            fill="#fafaf7"
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
          className="mx-auto"
        >
          <rect x="16" y="16" width="96" height="96" rx="24" fill="#cc785c" />
          <path
            d="M46 40 C54 40 60 46 60 54 C60 62 54 68 46 68 C38 68 32 62 32 54 C32 46 38 40 46 40 Z"
            fill="#fafaf7"
            fillOpacity="0.6"
            stroke="#191919"
            strokeWidth="2"
          />
          <path
            d="M48 48 H76 V76 H48 Z"
            fill="#fafaf7"
            stroke="#191919"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M72 30 C72 34 70 35 66 35 C70 35 72 36 72 40 C72 36 74 35 78 35 C74 35 72 34 72 30 Z"
            fill="#fafaf7"
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
        <h3 className="type-h4 max-w-md balance leading-snug">
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

