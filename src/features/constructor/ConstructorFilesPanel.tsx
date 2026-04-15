export type ConstructorFile = { id: string; name: string; type?: string; uploadedAt: string };

export function ConstructorFilesPanel({ files }: { files: ConstructorFile[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Файли конструктора</h3>
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white">Завантажити файли</button>
      </div>
      <ul className="mt-3 space-y-2 text-xs">
        {files.length === 0 ? (
          <li className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-slate-500">Пакет ще не завантажено.</li>
        ) : (
          files.map((file) => (
            <li key={file.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="font-medium text-slate-900">{file.name}</p>
              <p className="text-slate-500">{file.type ?? "unknown"} · {file.uploadedAt}</p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
