import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold tracking-[-.01em]",
  {
    variants: {
      variant: {
        neutral: "bg-[#f0efec] text-[#66666c]",
        success: "bg-[#e8f6ec] text-[#2c7a46]",
        warning: "bg-[#fff3dc] text-[#986821]",
        purple: "bg-[#eeecff] text-[#544bd6]",
        blue: "bg-[#eaf2ff] text-[#386bb1]",
        rose: "bg-[#ffebee] text-[#ae4e5c]",
        dark: "bg-[#292a2d] text-white",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
