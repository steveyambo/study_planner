"use client";

export function DeleteCourseForm({ id, code }: { id: string; code: string }) {
  return (
    <form action="/courses/delete" method="post" className="mt-4" onSubmit={(event) => {
      if (!window.confirm(`Supprimer ${code} et ses horaires, examens et séances de révision associés ? Cette action est définitive.`)) event.preventDefault();
    }}>
      <input type="hidden" name="id" value={id} />
      <button className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Supprimer le cours</button>
    </form>
  );
}
