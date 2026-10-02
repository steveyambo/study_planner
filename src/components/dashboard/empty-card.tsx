type EmptyCardProps = {
  title: string;
  message: string;
};

export function EmptyCard({ title, message }: EmptyCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-4 text-sm leading-6 text-slate-600">{message}</p>
    </section>
  );
}
