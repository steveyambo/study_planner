"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

type SheetSide = "top" | "right" | "bottom" | "left" | "responsive";
const sides: Record<SheetSide, string> = {
  top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
  right: "inset-y-0 right-0 h-full w-[min(92vw,28rem)] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
  bottom: "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
  left: "inset-y-0 left-0 h-full w-[min(92vw,28rem)] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
  responsive: "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[28rem] lg:rounded-none lg:border-l lg:border-t-0",
};

const SheetContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: SheetSide; showCloseButton?: boolean }>(
  ({ side = "right", className, children, showCloseButton = true, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content ref={ref} className={cn("fixed z-50 overflow-y-auto overscroll-contain border-slate-200 bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out focus:outline-none", sides[side], className)} {...props}>
        {children}
        {showCloseButton && <DialogPrimitive.Close className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
          <X className="size-5" aria-hidden="true" /><span className="sr-only">Fermer</span>
        </DialogPrimitive.Close>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
SheetContent.displayName = "SheetContent";

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-2 pr-10 text-left", className)} {...props} />;
}
function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}
const SheetTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(({ className, ...props }, ref) => <DialogPrimitive.Title ref={ref} className={cn("min-w-0 break-words text-xl font-semibold tracking-tight text-slate-950", className)} {...props} />);
SheetTitle.displayName = "SheetTitle";
const SheetDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(({ className, ...props }, ref) => <DialogPrimitive.Description ref={ref} className={cn("min-w-0 break-words text-sm leading-6 text-slate-500", className)} {...props} />);
SheetDescription.displayName = "SheetDescription";

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };
