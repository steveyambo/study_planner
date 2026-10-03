import type { Course } from "@/types/course";

export function CourseForm({ course, periodsReady = true }: { course?: Course; periodsReady?: boolean }) {
  const prefix = course?.id ?? "new";
  const inputStyle = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-2 focus:outline-indigo-600";
  return (
    <form action="/courses/save" method="post" className="space-y-4">
      {course && <input type="hidden" name="id" value={course.id} />}
      <div>
        <label htmlFor={`${prefix}-code`} className="text-sm font-medium">Code du cours</label>
        <input id={`${prefix}-code`} name="code" defaultValue={course?.code ?? ""} placeholder="INF3105" required maxLength={40} className={inputStyle} />
      </div>
      <div>
        <label htmlFor={`${prefix}-name`} className="text-sm font-medium">Nom du cours</label>
        <input id={`${prefix}-name`} name="name" defaultValue={course?.name ?? ""} required maxLength={160} className={inputStyle} />
      </div>
      <div>
        <label htmlFor={`${prefix}-multiplier`} className="text-sm font-medium">Multiplicateur de révision</label>
        <input id={`${prefix}-multiplier`} name="revision_multiplier" type="number" min="0.01" max="99.99" step="0.01" defaultValue={course?.revision_multiplier ?? 2} required className={inputStyle} aria-describedby={`${prefix}-help`} />
        <p id={`${prefix}-help`} className="mt-2 text-xs leading-5 text-slate-600">Avec 2, une heure de cours correspond à deux heures de révision.</p>
      </div>
      <div>
        <label htmlFor={`${prefix}-color`} className="text-sm font-medium">Couleur du cours</label>
        <input id={`${prefix}-color`} name="color" type="color" defaultValue={course?.color ?? "#4f46e5"} className="mt-2 block h-10 w-16 rounded border border-slate-300" />
      </div>
      <fieldset disabled={!periodsReady} className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Période de cette matière (facultative)</legend>
        <div><label htmlFor={`${prefix}-starts`} className="text-sm">Premier jour de cours</label>
          <input id={`${prefix}-starts`} name="starts_on" type="date" min="0001-01-01" max="9999-12-31" defaultValue={course?.starts_on ?? ""} className={inputStyle} /></div>
        <div><label htmlFor={`${prefix}-ends`} className="text-sm">Dernier jour de cours</label>
          <input id={`${prefix}-ends`} name="ends_on" type="date" min="0001-01-01" max="9999-12-31" defaultValue={course?.ends_on ?? ""} className={inputStyle} /></div>
        <p className="text-xs leading-5 text-slate-600 sm:col-span-2">Dates incluses. Sans date, la période choisie dans Planification s’applique. Les révisions peuvent continuer après le dernier cours, avant l’examen et jusqu’à la fin du planning.</p>
      </fieldset>
      <button disabled={!periodsReady} className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">
        {course ? "Enregistrer les modifications" : "Ajouter le cours"}
      </button>
    </form>
  );
}
