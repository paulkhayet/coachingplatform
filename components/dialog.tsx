"use client";

import type { ComponentProps } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn("modal-backdrop", className)}
      {...props}
    />
  );
}

function DialogContent({
  className,
  overlayClassName,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  overlayClassName?: string;
}) {
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-[12vh] z-[100] -translate-x-1/2 outline-none",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DrawerContent({
  className,
  overlayClassName,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  overlayClassName?: string;
}) {
  return (
    <DialogPortal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-[100] bg-[rgba(25,25,28,0.3)] backdrop-blur-[2px]",
          overlayClassName,
        )}
      />
      <DialogPrimitive.Content
        className={cn("fixed inset-y-0 right-0 z-[100] outline-none", className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DrawerContent,
};
