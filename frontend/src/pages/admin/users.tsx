import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { useAdminUsers, useUpdateUser } from "@/hooks/use-admin";
import { formatDate, formatNumber, formatToman } from "@/lib/format";
import { useAuthStore } from "@/store/auth-store";
import type { AdminUserQuery, Role } from "@/types/api";

const PAGE_SIZE = 20;

/** Accounts, with the role and access switches an operator needs. */
export function AdminUsers() {
  const [params, setParams] = useSearchParams();
  const me = useAuthStore((state) => state.user);

  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const q = params.get("q") ?? "";
  const role = (params.get("role") as Role | "all" | null) ?? "all";

  const [search, setSearch] = React.useState(q);
  React.useEffect(() => setSearch(q), [q]);

  const [busyId, setBusyId] = React.useState<number | null>(null);

  const query: AdminUserQuery = React.useMemo(
    () => ({ q: q || undefined, role: role === "all" ? undefined : role, page, limit: PAGE_SIZE }),
    [q, role, page],
  );

  const { data, isLoading, isFetching } = useAdminUsers(query);
  const update = useUpdateUser();

  const apply = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
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

  const filtersApplied = q !== "" || role !== "all";

  return (
    <>
      <AdminPageHeader
        icon={Users}
        title="کاربران"
        description={data ? `${formatNumber(data.total)} حساب کاربری` : "حساب‌های کاربری فروشگاه"}
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
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="admin-user-q">جست‌وجو</Label>
              <div className="relative">
                <Search className="absolute inset-y-0 end-3 my-auto size-4 text-muted-foreground" />
                <Input
                  id="admin-user-q"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="نام، ایمیل یا شماره موبایل"
                  className="pe-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>نقش</Label>
              <Select value={role} onValueChange={(value) => apply({ role: value === "all" ? undefined : value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="customer">مشتری</SelectItem>
                  <SelectItem value="admin">مدیر</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
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
                <Skeleton key={index} className="h-14 rounded-md" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {filtersApplied ? "کاربری با این مشخصات پیدا نشد." : "هنوز کاربری ثبت نشده است."}
            </p>
          ) : (
            <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>کاربر</TableHead>
                    <TableHead>موبایل</TableHead>
                    <TableHead>نقش</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>سفارش‌ها</TableHead>
                    <TableHead>مجموع خرید</TableHead>
                    <TableHead>عضویت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((row) => (
                    <TableRow key={row.user.id}>
                      <TableCell>
                        <span className="block font-medium">
                          {row.user.name || "—"}
                          {me?.id === row.user.id ? (
                            <span className="ms-2 text-[11px] text-muted-foreground">(شما)</span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground" dir="ltr">
                          {row.user.email}
                        </span>
                      </TableCell>
                      <TableCell dir="ltr" className="text-end text-xs">
                        {row.user.phone || "—"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.user.role}
                          disabled={busyId === row.user.id}
                          onValueChange={(value) => {
                            setBusyId(row.user.id);
                            update.mutate(
                              { id: row.user.id, body: { role: value as Role } },
                              { onSettled: () => setBusyId(null) },
                            );
                          }}
                        >
                          <SelectTrigger className="h-8 w-28" aria-label="نقش کاربر">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customer">مشتری</SelectItem>
                            <SelectItem value="admin">مدیر</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={row.user.isActive}
                          disabled={busyId === row.user.id}
                          aria-label="فعال بودن حساب"
                          onCheckedChange={(checked) => {
                            setBusyId(row.user.id);
                            update.mutate(
                              { id: row.user.id, body: { isActive: checked } },
                              { onSettled: () => setBusyId(null) },
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell>{formatNumber(row.orderCount)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatToman(row.totalSpent)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(row.user.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

                            <PaginationBar
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                pageSize={PAGE_SIZE}
                itemLabel="کاربر"
                onChange={goToPage}
                className="mt-6"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        نقش خودتان و آخرین مدیر فعال قابل تغییر نیست.
      </p>
    </>
  );
}
