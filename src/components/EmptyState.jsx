export default function EmptyState({ title, description }) {
  return (
    <div className="panel flex min-h-40 items-center justify-center px-6 py-10 text-center">
      <div>
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}
