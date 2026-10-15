import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationNumber,
  PaginationPrevious,
} from "@/components/ui/pagination";

/** Builds page numbers around the current page, with gaps collapsed. */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const result: (number | "gap")[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push("gap");
    result.push(page);
    previous = page;
  }
  return result;
}

interface TablePaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}

/**
 * Numbered pagination for the admin tables. The chevrons come from the shared
 * pagination primitives, which already mirror themselves in RTL.
 */
export function TablePagination({ page, totalPages, onChange, className }: TablePaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <Pagination className={className}>
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
              <span className="px-2 text-muted-foreground">…</span>
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
  );
}
