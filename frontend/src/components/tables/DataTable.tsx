import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnSizingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import Tooltip from "../Tooltip";

export type { SortingState };

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];
const MIN_COL_WIDTH = 60;
const CHAR_WIDTH_PX = 8;
const CELL_PADDING = 24;

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
  toolbar?: ReactNode;
  statusText?: ReactNode;
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
  toolbar,
  statusText,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [localPageSize, setLocalPageSize] = useState(pageSize);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const effectivePageSize = manualPagination ? pageSize : localPageSize;

  // Compute initial column sizes based on longest data value per column
  const initialColumnSizing = useMemo(() => {
    const sizing: Record<string, number> = {};
    for (const col of columns) {
      const accessorKey = (col as { accessorKey?: string }).accessorKey;
      if (!accessorKey) continue;

      // If column def specifies an explicit size, use it instead of computing from data
      const explicitSize = (col as { size?: number }).size;
      if (explicitSize) {
        sizing[accessorKey] = explicitSize;
        continue;
      }

      const headerText = typeof col.header === "string" ? col.header : accessorKey;
      let maxLen = headerText.length;

      for (const row of data) {
        const val = (row as Record<string, unknown>)[accessorKey];
        if (val != null) {
          const strLen = String(val).length;
          if (strLen > maxLen) maxLen = strLen;
        }
      }

      const computed = maxLen * CHAR_WIDTH_PX + CELL_PADDING;
      sizing[accessorKey] = Math.max(MIN_COL_WIDTH, computed);
    }
    return sizing;
  }, [data, columns]);

  // Reset user-adjusted sizes when data changes
  useEffect(() => {
    setColumnSizing({});
  }, [data]);

  // Close column picker on outside click
  useEffect(() => {
    if (!showColumnPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showColumnPicker]);

  // Merge: user-adjusted sizes override computed initial sizes
  const effectiveColumnSizing = useMemo(() => {
    return { ...initialColumnSizing, ...columnSizing };
  }, [initialColumnSizing, columnSizing]);

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
    defaultColumn: {
      minSize: MIN_COL_WIDTH,
    },
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    state: {
      sorting,
      columnSizing: effectiveColumnSizing,
      columnVisibility,
      ...(manualPagination
        ? { pagination: { pageIndex: pageIndex ?? 0, pageSize: effectivePageSize } }
        : {}),
    },
    onSortingChange: handleSortingChange,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    ...(manualSorting ? { manualSorting: true } : { getSortedRowModel: getSortedRowModel() }),
    ...(manualPagination
      ? { manualPagination: true, pageCount: pageCount ?? -1 }
      : { getPaginationRowModel: getPaginationRowModel() }),
    initialState: { pagination: { pageSize: effectivePageSize } },
  });

  const currentPage = manualPagination ? (pageIndex ?? 0) : table.getState().pagination.pageIndex;
  const totalPages = manualPagination ? (pageCount ?? 1) : table.getPageCount();
  const isResizing = table.getState().columnSizingInfo.isResizingColumn;

  const handlePageSizeChange = (newSize: number) => {
    if (manualPagination) {
      onPageSizeChange?.(newSize);
      onPageChange?.(0);
    } else {
      setLocalPageSize(newSize);
      table.setPageSize(newSize);
    }
  };

  const allColumns = table.getAllLeafColumns();
  const hiddenCount = allColumns.filter((c) => !c.getIsVisible()).length;

  return (
    <div className={isResizing ? "cursor-col-resize" : ""}>
      <div className="flex items-center gap-2 mb-2 relative" ref={pickerRef}>
        {statusText}
        <div className="flex items-center gap-2 ml-auto">
          {toolbar}
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-600"
            onClick={() => setShowColumnPicker((v) => !v)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
            </svg>
            Columns{hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ""}
          </button>
        </div>
        {showColumnPicker && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px] max-h-[320px] overflow-y-auto">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase">Toggle columns</span>
              <button
                className="text-xs text-indigo-600 hover:text-indigo-800"
                onClick={() => setColumnVisibility({})}
              >
                Show all
              </button>
            </div>
            {allColumns.map((column) => {
              const header = column.columnDef.header;
              const label = typeof header === "string" ? header : column.id;
              return (
                <label
                  key={column.id}
                  className="flex items-center gap-2 py-1 px-1 rounded hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {label}
                </label>
              );
            })}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table
          className="text-sm"
          style={{ width: table.getCenterTotalSize(), tableLayout: "fixed" }}
        >
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-gray-200">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left font-semibold text-gray-600 bg-gray-50 select-none whitespace-nowrap relative group"
                    style={{ width: header.getSize() }}
                  >
                    <span
                      className="flex items-center gap-1 cursor-pointer"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder ? null : (
                        header.column.columnDef.meta?.tooltip ? (
                          <Tooltip text={header.column.columnDef.meta.tooltip}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </Tooltip>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )
                      )}
                      {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                    </span>
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none ${
                        header.column.getIsResizing()
                          ? "bg-indigo-500"
                          : "bg-transparent group-hover:bg-gray-300"
                      }`}
                    />
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
                  <td
                    key={cell.id}
                    className="px-3 py-2 break-words overflow-hidden"
                    style={{ width: cell.column.getSize() }}
                  >
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
