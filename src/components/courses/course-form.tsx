import { Button } from "@/components/ui/button";
import type { Course } from "@/types/course";

export function CourseForm({ course, periodsReady = true }: { course?: Course; periodsReady?: boolean }) {
  const prefix = course?.id ?? "new";
  const inputStyle = "field-input mt-2";
  return (
    <form action="/courses/save" method="post" className="space-y-4">
      {course && <input type="hidden" name="id" value={course.id} />}
      <div>
        <label htmlFor={`${prefix}-code`} className="text-sm font-medium text-slate-700">Code du cours</label>
        <input id={`${prefix}-code`} name="code" defaultValue={course?.code ?? ""} placeholder="Ex. INF3105" autoCapitalize="characters" required maxLength={40} className={inputStyle} />
      </div>
      <div>
        <label htmlFor={`${prefix}-name`} className="text-sm font-medium text-slate-700">Nom du cours</label>
        <input id={`${prefix}-name`} name="name" defaultValue={course?.name ?? ""} placeholder="Ex. Algorithmie" required maxLength={160} className={inputStyle} />
      </div>
      <div>
        <label htmlFor={`${prefix}-multiplier`} className="text-sm font-medium text-slate-700">Heures de révision pour 1 h de cours</label>
        <input id={`${prefix}-multiplier`} name="revision_multiplier" type="number" min="0.01" max="99.99" step="0.01" defaultValue={course?.revision_multiplier ?? 2} required className={inputStyle} aria-describedby={`${prefix}-help`} />
        <p id={`${prefix}-help`} className="mt-2 text-xs leading-5 text-slate-600">Avec 2, une heure de cours correspond à deux heures de révision.</p>
      </div>
      <div>
        <label htmlFor={`${prefix}-color`} className="text-sm font-medium text-slate-700">Couleur du cours</label>
        <input id={`${prefix}-color`} name="color" type="color" defaultValue={course?.color ?? "#4f46e5"} className="mt-2 block h-12 w-20 cursor-pointer rounded-xl border border-slate-200 bg-white p-1" />
      </div>
      <fieldset disabled={!periodsReady} className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Période de cette matière (facultative)</legend>
        <div><label htmlFor={`${prefix}-starts`} className="text-sm">Premier jour de cours</label>
          <input id={`${prefix}-starts`} name="starts_on" type="date" min="0001-01-01" max="9999-12-31" defaultValue={course?.starts_on ?? ""} className={inputStyle} /></div>
        <div><label htmlFor={`${prefix}-ends`} className="text-sm">Dernier jour de cours</label>
          <input id={`${prefix}-ends`} name="ends_on" type="date" min="0001-01-01" max="9999-12-31" defaultValue={course?.ends_on ?? ""} className={inputStyle} /></div>
        <p className="text-xs leading-5 text-slate-600 sm:col-span-2">Dates incluses. Sans date, la période choisie dans Planification s’applique. Les révisions peuvent continuer après le dernier cours, avant l’examen et jusqu’à la fin du planning.</p>
      </fieldset>
      <Button disabled={!periodsReady} className="w-full">
        {course ? "Enregistrer les modifications" : "Ajouter le cours"}
      </Button>
    </form>
  );
}
