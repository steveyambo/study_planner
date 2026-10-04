type EmptyCardProps = {
  title: string;
  message: string;
};

export function EmptyCard({ title, message }: EmptyCardProps) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
    </section>
  );
}
