import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Native select styled with the same tokens and focus treatment as shadcn Input.
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative w-full", className)}>
      <select className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" {...props}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-3 top-2.5 size-4 text-muted-foreground" />
    </div>
  );
}
