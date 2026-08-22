"use client";

import type { ReactNode } from "react";
import { DataTable, type DataTableColumn, EmptyState, Skeleton } from "@arcevo/facet-components";

interface ConsoleDataTableProps<T extends object> {
  data: T[] | null;
  columns: DataTableColumn<T>[];
  rowKey?: keyof T;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  searchable?: boolean;
  exportable?: boolean;
  pagination?: boolean;
  actions?: ReactNode;
  noDataMessage?: string;
  className?: string;
}

export function ConsoleDataTable<T extends object>({
  data,
  columns,
  rowKey,
  loading,
  emptyTitle = "No items found",
  emptyDescription = "There are no items to display.",
  searchable = true,
  exportable = false,
  pagination = true,
  actions,
  noDataMessage,
  className,
}: ConsoleDataTableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full max-w-xs" />
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={noDataMessage ? <p className="text-sm text-muted-foreground">{noDataMessage}</p> : undefined}
      />
    );
  }

  return (
    <div className={className}>
      {actions && <div className="mb-4 flex justify-end">{actions}</div>}
      <DataTable
        columns={columns}
        data={data}
        rowKey={rowKey ?? "id"}
        searchable={searchable}
        exportable={exportable}
        pagination={pagination}
        className="border-none"
      />
    </div>
  );
}
