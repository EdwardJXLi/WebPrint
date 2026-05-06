export default function LoadingScreen({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <div className="panel w-full max-w-md p-8 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-green-700" />
        <p className="mt-4 text-sm text-slate-600">{label}</p>
      </div>
    </div>
  );
}
