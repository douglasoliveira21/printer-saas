"use client";

import type { MouseEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "./table-skeleton";
import { EmptyState } from "./empty-state";
import type { LucideIcon } from "lucide-react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Omit this field from the mobile card body — use for columns already represented by cardTitle/cardMeta. */
  hideOnMobile?: boolean;
}

export interface ResponsiveDataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[] | undefined;
  keyField: (row: T) => string;
  isLoading?: boolean;
  emptyIcon?: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
  /** Mobile-only: heading shown at the top of each card (e.g. the row's primary identifier). */
  cardTitle: (row: T) => ReactNode;
  /** Mobile-only: content shown next to the title, e.g. a status badge. */
  cardMeta?: (row: T) => ReactNode;
  /** Mobile-only: action buttons shown at the bottom of each card. */
  cardActions?: (row: T) => ReactNode;
  /** When set, the whole row/card navigates here on click (clicks on buttons/links/selects inside are excluded). */
  rowHref?: (row: T) => string;
  /**
   * Alternative to rowHref for lists that need a different action on a
   * single click than on navigation — e.g. Clientes: single click opens a
   * quick-actions dialog, double click opens the detail page. Mutually
   * exclusive with rowHref (if both are given, rowHref wins for the single
   * click and onRowDoubleClick still applies). Same interactive-element
   * exclusion as rowHref.
   */
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
}

/**
 * Renders as a normal table at md+ and as a stacked card list below md, so
 * wide operational tables (6-7 columns) stay usable on a phone instead of
 * only horizontal-scrolling.
 */
export function ResponsiveDataTable<T>({
  columns,
  data,
  keyField,
  isLoading,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  cardTitle,
  cardMeta,
  cardActions,
  rowHref,
  onRowClick,
  onRowDoubleClick,
}: ResponsiveDataTableProps<T>) {
  const isEmpty = !isLoading && (!data || data.length === 0);
  const router = useRouter();
  const isInteractive = !!rowHref || !!onRowClick || !!onRowDoubleClick;

  function isInsideInteractiveElement(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    return !!target.closest('button, a, [role="button"], input, select, textarea');
  }

  function handleRowClick(row: T) {
    return (event: MouseEvent<HTMLElement>) => {
      if (isInsideInteractiveElement(event)) return;
      if (rowHref) {
        router.push(rowHref(row));
        return;
      }
      onRowClick?.(row);
    };
  }

  function handleRowDoubleClick(row: T) {
    return (event: MouseEvent<HTMLElement>) => {
      if (isInsideInteractiveElement(event)) return;
      onRowDoubleClick?.(row);
    };
  }

  return (
    <>
      {/* Desktop / tablet: real table */}
      <Card className="hidden overflow-hidden py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton columns={columns.length} />}
            {isEmpty && (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
                </TableCell>
              </TableRow>
            )}
            {data?.map((row) => (
              <TableRow
                key={keyField(row)}
                onClick={handleRowClick(row)}
                onDoubleClick={handleRowDoubleClick(row)}
                className={isInteractive ? "cursor-pointer" : undefined}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile: stacked cards */}
      <div className="space-y-3 md:hidden">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-24 animate-pulse bg-muted" />)}
        {isEmpty && (
          <Card>
            <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
          </Card>
        )}
        {data?.map((row) => (
          <Card
            key={keyField(row)}
            className={isInteractive ? "cursor-pointer p-4" : "p-4"}
            onClick={handleRowClick(row)}
            onDoubleClick={handleRowDoubleClick(row)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 font-medium">{cardTitle(row)}</div>
              {cardMeta?.(row)}
            </div>
            <dl className="mt-2 space-y-1">
              {columns
                .filter((col) => !col.hideOnMobile)
                .map((col) => (
                  <div key={col.key} className="flex items-center justify-between gap-2 text-sm">
                    <dt className="text-muted-foreground">{col.header}</dt>
                    <dd className="min-w-0 truncate text-right">{col.cell(row)}</dd>
                  </div>
                ))}
            </dl>
            {cardActions && <div className="mt-3 flex justify-end gap-2">{cardActions(row)}</div>}
          </Card>
        ))}
      </div>
    </>
  );
}
