import {
  Avatar as AvatarRoot,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "size-[26px] text-[8.5px]",
  md: "size-[34px] text-[10px]",
  lg: "size-[42px] text-[12px]",
  xl: "size-16 text-[17px]",
} as const;

export function Avatar({
  initials,
  color,
  imageUrl,
  size = "md",
  shape = "circle",
  className,
}: {
  initials: string;
  color?: string;
  imageUrl?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  shape?: "circle" | "square";
  className?: string;
}) {
  return (
    <AvatarRoot
      className={cn(
        SIZE_CLASSES[size],
        "font-semibold tracking-tight",
        shape === "square"
          ? "rounded-[10px] after:rounded-[10px]"
          : "rounded-full after:rounded-full",
        className,
      )}
    >
      {imageUrl ? <AvatarImage src={imageUrl} alt="" /> : null}
      <AvatarFallback
        style={{ background: color || "#ebe9e4" }}
        className={cn(
          shape === "square"
            ? "rounded-[10px] text-[13px] font-bold text-white"
            : "rounded-full text-[#343438]",
        )}
      >
        {initials}
      </AvatarFallback>
    </AvatarRoot>
  );
}
