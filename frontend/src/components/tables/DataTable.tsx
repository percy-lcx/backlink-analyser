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

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

interface Props<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  pageSize?: number;
  manualPagination?: boolean;
  pageCount?: number;
  pageIndex?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onRowClick?: (row: T) => void;
  getRowClassName?: (row: T) => string;
  manualSorting?: boolean;
  onSortChange?: (sorting: SortingState) => void;
}

export default function DataTable<T>({
  data,
  columns,
  pageSize = 100,
  manualPagination,
  pageCount,
  pageIndex,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  getRowClassName,
  manualSorting,
  onSortChange,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [localPageSize, setLocalPageSize] = useState(pageSize);

  const effectivePageSize = manualPagination ? pageSize : localPageSize;

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
      ...(manualPagination
        ? { pagination: { pageIndex: pageIndex ?? 0, pageSize: effectivePageSize } }
        : {}),
    },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    ...(manualSorting ? { manualSorting: true } : { getSortedRowModel: getSortedRowModel() }),
    ...(manualPagination
      ? { manualPagination: true, pageCount: pageCount ?? -1 }
      : { getPaginationRowModel: getPaginationRowModel() }),
    initialState: { pagination: { pageSize: effectivePageSize } },
  });

  const currentPage = manualPagination ? (pageIndex ?? 0) : table.getState().pagination.pageIndex;
  const totalPages = manualPagination ? (pageCount ?? 1) : table.getPageCount();

  const handlePageSizeChange = (newSize: number) => {
    if (manualPagination) {
      onPageSizeChange?.(newSize);
      onPageChange?.(0);
    } else {
      setLocalPageSize(newSize);
      table.setPageSize(newSize);
    }
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-gray-200">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left font-semibold text-gray-600 bg-gray-50 cursor-pointer select-none whitespace-nowrap"
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
                  <td key={cell.id} className="px-3 py-2 break-words">
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
        <div className="flex items-center gap-3">
          <span>
            Page {currentPage + 1} of {Math.max(totalPages, 1)}
          </span>
          <select
            value={effectivePageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} rows
              </option>
            ))}
          </select>
        </div>
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
