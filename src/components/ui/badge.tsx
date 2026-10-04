import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-indigo-50 text-indigo-700",
      secondary: "bg-slate-100 text-slate-600",
      outline: "border border-slate-200 text-slate-600",
      destructive: "bg-red-50 text-red-700",
      success: "bg-emerald-50 text-emerald-700",
      warning: "bg-amber-50 text-amber-800",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
