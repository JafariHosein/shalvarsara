import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationNumber,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { pageWindow } from "@/lib/pagination";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** Total number of rows, used for the "showing x–y of z" summary. */
  total?: number;
  /** Rows per page, used with `total`. */
  pageSize?: number;
  /** What the rows are, e.g. «محصول» — pluralised in the summary. */
  itemLabel?: string;
  className?: string;
}

function rangeLabel(page: number, pageSize: number, total: number): string {
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return `${formatNumber(first)}–${formatNumber(last)}`;
}

/**
 * Numbered pagination plus a plain-language summary.
 *
 * Used by the storefront listing and by every admin table, so the two never
 * drift apart. The labels inside the chevrons come from the shared pagination
 * primitives, which already mirror themselves in RTL.
 */
export function PaginationBar({
  page,
  totalPages,
  onChange,
  total,
  pageSize,
  itemLabel = "مورد",
  className,
}: PaginationBarProps) {
  const counts = total != null && pageSize != null ? { total, pageSize } : null;

  if (totalPages <= 1) {
    return counts && counts.total > 0 ? (
      <p className={cn("text-center text-sm text-muted-foreground", className)}>
        {`${formatNumber(counts.total)} ${itemLabel}`}
      </p>
    ) : null;
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 border-t pt-6 sm:flex-row sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">
        {counts
          ? `نمایش ${rangeLabel(page, counts.pageSize, counts.total)} از ${formatNumber(counts.total)} ${itemLabel}`
          : `صفحه ${formatNumber(page)} از ${formatNumber(totalPages)}`}
      </p>

      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={page <= 1}
              className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
              onClick={(event) => {
                event.preventDefault();
                if (page > 1) onChange(page - 1);
              }}
            />
          </PaginationItem>

          {pageWindow(page, totalPages).map((entry, index) =>
            entry === "gap" ? (
              <PaginationItem key={`gap-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={entry}>
                <PaginationNumber
                  page={entry}
                  href="#"
                  isActive={entry === page}
                  onClick={(event) => {
                    event.preventDefault();
                    onChange(entry);
                  }}
                />
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={page >= totalPages}
              className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
              onClick={(event) => {
                event.preventDefault();
                if (page < totalPages) onChange(page + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
