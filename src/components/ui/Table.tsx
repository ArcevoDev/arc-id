interface TableProps { headers: string[]; rows: (string | React.ReactNode)[][]; emptyMessage?: string; }
export function Table({ headers, rows, emptyMessage = "No data" }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 border-b border-zinc-200">
          <tr>{headers.map((h, i) => <th key={i} className="px-4 py-3 text-left font-medium text-zinc-600">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.length === 0
            ? <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-zinc-400">{emptyMessage}</td></tr>
            : rows.map((row, i) => (
              <tr key={i} className="hover:bg-zinc-50">
                {row.map((cell, j) => <td key={j} className="px-4 py-3 text-zinc-700">{cell}</td>)}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}
