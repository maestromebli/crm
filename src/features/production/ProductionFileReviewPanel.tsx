type ReviewFile = { id: string; name: string; fileType?: string };

export function ProductionFileReviewPanel({ files }: { files: ReviewFile[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Файли на рев&apos;ю</h3>
      <ul className="mt-3 space-y-2 text-xs">
        {files.length === 0 ? (
          <li className="text-slate-500">Файлів немає.</li>
        ) : (
          files.map((file) => (
            <li key={file.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="font-medium text-slate-900">{file.name}</p>
              <p className="text-slate-500">{file.fileType ?? "unknown"}</p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
