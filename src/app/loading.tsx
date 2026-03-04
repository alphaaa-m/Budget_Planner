export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-8 md:px-8">
      <div className="h-16 animate-pulse rounded-2xl bg-white/60 dark:bg-slate-800/70" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl bg-white/60 dark:bg-slate-800/70"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="h-72 animate-pulse rounded-2xl bg-white/60 dark:bg-slate-800/70"
          />
        ))}
      </div>
    </div>
  );
}
