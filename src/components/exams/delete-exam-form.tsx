"use client";

import { Button } from "@/components/ui/button";

export function DeleteExamForm({ id, title }: { id: string; title: string }) {
  return (
    <form action="/exams/manage" method="post" className="mt-4" onSubmit={(event) => { if (!window.confirm(`Supprimer l’examen « ${title} » ?`)) event.preventDefault(); }}>
      <input type="hidden" name="action" value="delete" /><input type="hidden" name="id" value={id} />
      <Button variant="ghost" className="-ml-3 text-red-700 hover:bg-red-50 hover:text-red-800">Supprimer l’examen</Button>
    </form>
  );
}
