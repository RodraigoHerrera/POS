export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400"></div>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium animate-pulse">
        Cargando módulo...
      </p>
    </div>
  );
}
