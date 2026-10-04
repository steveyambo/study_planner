"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function AddPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <Sheet>
    <SheetTrigger asChild><Button className="w-full sm:w-auto"><Plus aria-hidden="true" />{title}</Button></SheetTrigger>
    <SheetContent side="responsive">
      <SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{description}</SheetDescription></SheetHeader>
      <div className="mt-6">{children}</div>
    </SheetContent>
  </Sheet>;
}
