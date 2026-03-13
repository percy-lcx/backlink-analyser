import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";

export type { SortingState };

interface Props<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  pageSize?: number;
  manualPagination?: boolean;
  pageCount?: number;
  pageIndex?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  getRowClassName?: (row: T) => string;
  manualSorting?: boolean;
  onSortChange?: (sorting: SortingState) => void;
}

export default function DataTable<T>({
  data,
  columns,
  pageSize = 20,
  manualPagination,
  pageCount,
  pageIndex,
  onPageChange,
  onRowClick,
  getRowClassName,
  manualSorting,
  onSortChange,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const handleSortingChange: typeof setSorting = (updater) => {
    setSorting((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      onSortChange?.(next);
      return next;
    });
  };

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      ...(manualPagination ? { pagination: { pageIndex: pageIndex ?? 0, pageSize } } : {}),
    },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    ...(manualSorting ? { manualSorting: true } : { getSortedRowModel: getSortedRowModel() }),
    ...(manualPagination
      ? { manualPagination: true, pageCount: pageCount ?? -1 }
      : { getPaginationRowModel: getPaginationRowModel() }),
    initialState: { pagination: { pageSize } },
  });

  const currentPage = manualPagination ? (pageIndex ?? 0) : table.getState().pagination.pageIndex;
  const totalPages = manualPagination ? (pageCount ?? 1) : table.getPageCount();

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm table-fixed">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-gray-200">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left font-semibold text-gray-600 bg-gray-50 cursor-pointer select-none whitespace-nowrap"
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="flex items-center gap-1">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-gray-100 hover:bg-gray-50 ${onRowClick ? "cursor-pointer" : ""} ${getRowClassName ? getRowClassName(row.original) : ""}`}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 truncate" title={String(cell.getValue() ?? "")}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-gray-400">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
        <span>
          Page {currentPage + 1} of {Math.max(totalPages, 1)}
        </span>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => {
              if (manualPagination) onPageChange?.(currentPage - 1);
              else table.previousPage();
            }}
            disabled={manualPagination ? currentPage <= 0 : !table.getCanPreviousPage()}
          >
            Previous
          </button>
          <button
            className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => {
              if (manualPagination) onPageChange?.(currentPage + 1);
              else table.nextPage();
            }}
            disabled={manualPagination ? currentPage >= totalPages - 1 : !table.getCanNextPage()}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
