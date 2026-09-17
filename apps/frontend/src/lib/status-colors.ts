/** Centralized semantic color classes for status dots/badges, so accent colors live in one place instead of being hardcoded per page. */
export const STATUS_DOT = {
  online: "bg-emerald-500",
  offline: "bg-destructive",
  warning: "bg-amber-500",
  unknown: "bg-muted-foreground",
} as const;

export const STATUS_BADGE_CLASS = {
  online: "gap-1 border-transparent bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500",
  warning: "gap-1 border-transparent bg-amber-500 text-white hover:bg-amber-500 dark:bg-amber-600",
} as const;
