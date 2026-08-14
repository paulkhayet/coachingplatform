import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[13px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28282b]/25 disabled:pointer-events-none disabled:opacity-50 active:scale-[.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[#222326] text-white shadow-[0_1px_2px_rgba(0,0,0,.16)] hover:bg-[#343539]",
        accent:
          "bg-[#18181b] text-white shadow-[0_2px_8px_rgba(0,0,0,.25)] hover:bg-black",
        outline:
          "border border-[#e3e1dc] bg-white text-[#343438] shadow-[0_1px_2px_rgba(17,17,17,.03)] hover:border-[#cac7c0] hover:bg-[#faf9f7]",
        ghost: "text-[#68686e] hover:bg-[#f1f0ed] hover:text-[#28282b]",
        soft: "bg-[#eeece8] text-[#28282b] hover:bg-[#e5e3de]",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 rounded-[9px] px-3 text-xs",
        lg: "h-11 rounded-xl px-5 text-sm",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
