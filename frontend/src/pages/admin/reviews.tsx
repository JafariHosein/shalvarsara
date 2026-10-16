import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Eye, MessageSquareText, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { RatingStars } from "@/components/product/rating-stars";
import { useAdminReviews, useUpdateReviewStatus } from "@/hooks/use-admin";
import { formatDateTime, formatNumber, toFaDigits } from "@/lib/format";
import { REVIEW_STATUS_LABELS, type AdminReviewQuery, type AdminReviewRow, type ReviewStatus } from "@/types/api";

const PAGE_SIZE = 20;

/** "all" keeps every review; the rest map straight onto the API's status param. */
type StatusFilter = ReviewStatus | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "در انتظار تأیید" },
  { value: "approved", label: "تأییدشده" },
  { value: "rejected", label: "ردشده" },
  { value: "all", label: "همه" },
];

const STATUS_VARIANT: Record<ReviewStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

function readStatus(params: URLSearchParams): StatusFilter {
  const value = params.get("status") as StatusFilter | null;
  // The panel opens on the queue that needs an admin: the pending reviews.
  return value && STATUS_OPTIONS.some((option) => option.value === value) ? value : "pending";
}

/**
 * Review moderation: the customer-written reviews, newest first.
 *
 * The default filter is «در انتظار تأیید», so approving a row takes it out of
 * the list — the same way the products table works with its own filters.
 */
export function AdminReviews() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const q = params.get("q") ?? "";
  const status = readStatus(params);

  const [search, setSearch] = React.useState(q);
  React.useEffect(() => setSearch(q), [q]);

  const moderate = useUpdateReviewStatus();
  const [busyId, setBusyId] = React.useState<number | null>(null);
  /** The row whose full text is open in the detail dialog, if any. */
  const [viewing, setViewing] = React.useState<AdminReviewRow | null>(null);

  const query: AdminReviewQuery = React.useMemo(
    () => ({ q: q || undefined, status, page, limit: PAGE_SIZE }),
    [q, status, page],
  );

  const { data, isLoading, isFetching } = useAdminReviews(query);

  const apply = (patch: Record<string, string | undefined | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    setParams(next, { replace: true });
  };

  const reset = () => {
    setParams(new URLSearchParams(), { replace: true });
    setSearch("");
  };

  const goToPage = (target: number) => {
    const next = new URLSearchParams(params);
    if (target <= 1) next.delete("page");
    else next.set("page", String(target));
    setParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filtersApplied = q !== "" || status !== "pending";

  /** Moderate one row; the queue refetches and, with the pending filter, the row leaves. */
  const onModerate = (id: number, next: ReviewStatus, onSuccess?: () => void) => {
    setBusyId(id);
    moderate.mutate(
      { id, status: next },
      {
        // The dialog closes only on success; the row buttons pass nothing.
        onSuccess: () => onSuccess?.(),
        onSettled: () => setBusyId(null),
      },
    );
  };

  return (
    <>
      <AdminPageHeader
        icon={MessageSquareText}
        title="نظرات"
        description={data ? `${formatNumber(data.total)} نظر` : "بررسی و تأیید نظرات خریداران"}
      />

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              apply({ q: search.trim() });
            }}
          >
            <div className="space-y-2 sm:col-span-2 lg:col-span-2">
              <Label htmlFor="admin-review-q">جست‌وجو</Label>
              <div className="relative">
                <Search className="absolute inset-y-0 end-3 my-auto size-4 text-muted-foreground" />
                <Input
                  id="admin-review-q"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="نام محصول، نام مشتری یا ایمیل"
                  className="pe-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>وضعیت</Label>
              <Select value={status} onValueChange={(value) => apply({ status: value === "pending" ? undefined : value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" variant="secondary" className="gap-1.5">
                <Search className="size-4" />
                اعمال جست‌وجو
              </Button>
              {filtersApplied && (
                <Button type="button" variant="ghost" className="gap-1.5" onClick={reset}>
                  <X className="size-4" />
                  حذف فیلترها
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((index) => (
                <Skeleton key={index} className="h-16 rounded-md" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {filtersApplied ? "نظری با این مشخصات پیدا نشد." : "صف بررسی خالی است؛ همهٔ نظرات رسیدگی شده‌اند."}
            </p>
          ) : (
            <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
              {/* `table-fixed` + percentage/narrow-column widths let the table
                  shrink to the card instead of forcing the `overflow-auto`
                  wrapper to scroll sideways. The wide text columns absorb the
                  leftover width; the least important ones drop on small screens
                  (always together with their own `TableHead`). */}
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead>نظر</TableHead>
                    <TableHead className="hidden w-[13%] sm:table-cell">محصول</TableHead>
                    <TableHead className="hidden w-[13%] md:table-cell">مشتری</TableHead>
                    <TableHead className="hidden w-[10.5rem] whitespace-nowrap xl:table-cell">تاریخ</TableHead>
                    <TableHead className="hidden w-[8rem] whitespace-nowrap sm:table-cell">وضعیت</TableHead>
                    <TableHead className="w-[10rem] text-end whitespace-nowrap sm:w-[13.5rem]">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((row) => {
                    const busy = busyId === row.review.id;
                    return (
                      <TableRow key={row.review.id}>
                        <TableCell className="align-top">
                          <RatingStars value={row.review.rating} />
                          {row.review.comment ? (
                            <p className="mt-1.5 line-clamp-2 break-words text-sm leading-6 text-muted-foreground">
                              {row.review.comment}
                            </p>
                          ) : (
                            <p className="mt-1.5 text-xs text-muted-foreground">بدون متن</p>
                          )}
                        </TableCell>

                        <TableCell className="hidden align-top sm:table-cell">
                          <Link
                            to={`/products/${row.productSlug}`}
                            className="line-clamp-2 break-words font-medium hover:text-primary"
                          >
                            {toFaDigits(row.productTitle)}
                          </Link>
                        </TableCell>

                        <TableCell className="hidden align-top md:table-cell">
                          <span className="block break-words font-medium">{row.author}</span>
                          <span className="mt-0.5 block break-words text-[11px] text-muted-foreground" dir="ltr">
                            {row.email}
                          </span>
                        </TableCell>

                        <TableCell className="hidden whitespace-nowrap align-top text-muted-foreground xl:table-cell">
                          {formatDateTime(row.review.createdAt)}
                        </TableCell>

                        <TableCell className="hidden align-top sm:table-cell">
                          <Badge variant={STATUS_VARIANT[row.review.status]} className="whitespace-nowrap">
                            {REVIEW_STATUS_LABELS[row.review.status]}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-end align-top">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="size-9"
                              title="مشاهدهٔ کامل"
                              aria-label="مشاهدهٔ کامل"
                              onClick={() => setViewing(row)}
                            >
                              <Eye className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1 whitespace-nowrap text-success"
                              disabled={busy || row.review.status === "approved"}
                              onClick={() => onModerate(row.review.id, "approved")}
                            >
                              <Check className="size-3.5" />
                              <span className="hidden sm:inline">تأیید</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1 whitespace-nowrap text-destructive"
                              disabled={busy || row.review.status === "rejected"}
                              onClick={() => onModerate(row.review.id, "rejected")}
                            >
                              <X className="size-3.5" />
                              <span className="hidden sm:inline">رد</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <PaginationBar
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                pageSize={data.limit}
                itemLabel="نظر"
                onChange={goToPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-lg">
          {viewing ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-start">مشاهدهٔ کامل نظر</DialogTitle>
                <DialogDescription className="text-start">
                  متن کامل و مشخصات این نظر را پیش از تأیید یا رد ببینید.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="max-h-[45vh] overflow-y-auto rounded-lg border bg-muted/30 p-4">
                  {viewing.review.comment ? (
                    <p className="whitespace-pre-line break-words text-sm leading-7">{viewing.review.comment}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">بدون متن</p>
                  )}
                </div>

                <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <div>
                    <span className="block text-xs text-muted-foreground">محصول</span>
                    <span className="mt-0.5 block font-medium">{toFaDigits(viewing.productTitle)}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">مشتری</span>
                    <span className="mt-0.5 block font-medium">{viewing.author}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">ایمیل</span>
                    <span className="mt-0.5 block text-muted-foreground">{viewing.email}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">تاریخ</span>
                    <span className="mt-0.5 block text-muted-foreground">
                      {formatDateTime(viewing.review.createdAt)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">امتیاز</span>
                    <div className="mt-0.5">
                      <RatingStars value={viewing.review.rating} />
                    </div>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">وضعیت</span>
                    <span className="mt-0.5 block">
                      <Badge variant={STATUS_VARIANT[viewing.review.status]}>
                        {REVIEW_STATUS_LABELS[viewing.review.status]}
                      </Badge>
                    </span>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5 text-success"
                  disabled={busyId === viewing.review.id || viewing.review.status === "approved"}
                  onClick={() => onModerate(viewing.review.id, "approved", () => setViewing(null))}
                >
                  <Check />
                  تأیید
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5 text-destructive"
                  disabled={busyId === viewing.review.id || viewing.review.status === "rejected"}
                  onClick={() => onModerate(viewing.review.id, "rejected", () => setViewing(null))}
                >
                  <X />
                  رد
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
