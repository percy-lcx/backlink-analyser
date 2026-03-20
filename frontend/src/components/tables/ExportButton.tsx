import type { ColumnDef } from "@tanstack/react-table";

interface ColumnMapping {
  key: string;
  header: string;
}

interface Props {
  data: Record<string, unknown>[];
  filename?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns?: ColumnDef<any, unknown>[];
}

function extractColumnMappings(columns: ColumnDef<unknown, unknown>[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  for (const col of columns) {
    const key = (col as { accessorKey?: string }).accessorKey;
    const header = col.header;
    if (typeof key === "string" && typeof header === "string") {
      mappings.push({ key, header });
    }
  }
  return mappings;
}

function toCsv(data: Record<string, unknown>[], columns?: ColumnDef<unknown, unknown>[]): string {
  if (data.length === 0) return "";
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  if (columns) {
    const mappings = extractColumnMappings(columns);
    const headerRow = mappings.map((m) => escape(m.header)).join(",");
    const rows = data.map((row) => mappings.map((m) => escape(row[m.key])).join(","));
    return [headerRow, ...rows].join("\n");
  }

  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => escape(row[h])).join(","));
  return [headers.join(","), ...rows].join("\n");
}

export default function ExportButton({ data, filename = "export.csv", columns }: Props) {
  const handleExport = () => {
    const csv = toCsv(data, columns as ColumnDef<unknown, unknown>[] | undefined);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
      </svg>
      Export CSV
    </button>
  );
}
