"use client";

export function DeleteExamForm({ id, title }: { id: string; title: string }) {
  return (
    <form action="/exams/manage" method="post" className="mt-4" onSubmit={(event) => { if (!window.confirm(`Supprimer l’examen « ${title} » ?`)) event.preventDefault(); }}>
      <input type="hidden" name="action" value="delete" /><input type="hidden" name="id" value={id} />
      <button className="text-sm font-semibold text-red-700 underline">Supprimer l’examen</button>
    </form>
  );
}
