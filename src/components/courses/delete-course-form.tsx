"use client";

import { Button } from "@/components/ui/button";

export function DeleteCourseForm({ id, code }: { id: string; code: string }) {
  return (
    <form action="/courses/delete" method="post" className="mt-4" onSubmit={(event) => {
      if (!window.confirm(`Archiver ${code} ? Le cours sera retiré des prochains calculs et ses révisions planifiées à partir d’aujourd’hui seront annulées. Les séances terminées et l’historique seront conservés.`)) event.preventDefault();
    }}>
      <input type="hidden" name="id" value={id} />
      <Button variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800">Archiver le cours</Button>
    </form>
  );
}
