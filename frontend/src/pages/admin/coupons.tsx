import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BadgePercent, Pencil, Plus, Search, X } from "lucide-react";

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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { MoneyInput } from "@/components/ui/money-input";
import { useAdminCoupons, useCreateCoupon, useUpdateCoupon } from "@/hooks/use-admin";
import { formatDate, formatNumber, formatToman } from "@/lib/format";
import { couponSchema, dateInputToISO, digitsToNumber, isoToDateInput, type CouponFormValues } from "@/lib/schemas";
import type { Coupon } from "@/types/api";

const PAGE_SIZE = 20;

const EMPTY: CouponFormValues = {
  code: "",
  type: "percent",
  amount: "",
  minOrder: "",
  maxUses: "",
  expiresAt: "",
  isActive: true,
};

function toFormValues(coupon: Coupon): CouponFormValues {
  return {
    code: coupon.code,
    type: coupon.type,
    amount: String(coupon.amount),
    minOrder: String(coupon.minOrder),
    maxUses: String(coupon.maxUses),
    expiresAt: isoToDateInput(coupon.expiresAt),
    isActive: coupon.isActive,
  };
}

/** Discount codes: create, edit, pause. */
export function AdminCoupons() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const q = params.get("q") ?? "";

  const [search, setSearch] = React.useState(q);
  React.useEffect(() => setSearch(q), [q]);

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Coupon | null>(null);

  const query = React.useMemo(() => ({ q: q || undefined, page, limit: PAGE_SIZE }), [q, page]);
  const { data, isLoading, isFetching } = useAdminCoupons(query);
  const create = useCreateCoupon();
  const update = useUpdateCoupon();

  const form = useForm<CouponFormValues>({ resolver: zodResolver(couponSchema), defaultValues: EMPTY });
  const type = form.watch("type");

  const openCreate = () => {
    setEditing(null);
    form.reset(EMPTY);
    setOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditing(coupon);
    form.reset(toFormValues(coupon));
    setOpen(true);
  };

  const onSubmit = (values: CouponFormValues) => {
    const expiresAt = dateInputToISO(values.expiresAt);
    const done = { onSuccess: () => setOpen(false) };

    if (editing) {
      update.mutate(
        {
          id: editing.id,
          body: {
            code: values.code.trim().toUpperCase(),
            type: values.type,
            amount: digitsToNumber(values.amount),
            minOrder: digitsToNumber(values.minOrder),
            maxUses: digitsToNumber(values.maxUses),
            isActive: values.isActive,
            expiresAt,
            clearExpiry: expiresAt === null,
          },
        },
        done,
      );
      return;
    }

    create.mutate(
      {
        code: values.code.trim().toUpperCase(),
        type: values.type,
        amount: digitsToNumber(values.amount),
        minOrder: digitsToNumber(values.minOrder),
        maxUses: digitsToNumber(values.maxUses),
        isActive: values.isActive,
        expiresAt,
      },
      done,
    );
  };

  const goToPage = (target: number) => {
    const next = new URLSearchParams(params);
    if (target <= 1) next.delete("page");
    else next.set("page", String(target));
    setParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pending = create.isPending || update.isPending;

  return (
    <>
      <AdminPageHeader
        icon={BadgePercent}
        title="کدهای تخفیف"
        description={data ? `${formatNumber(data.total)} کد` : "کدهای تخفیف فروشگاه"}
      >
        <Button className="gap-1.5" onClick={openCreate}>
          <Plus className="size-4" />
          کد جدید
        </Button>
      </AdminPageHeader>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const next = new URLSearchParams(params);
              const trimmed = search.trim();
              if (trimmed) next.set("q", trimmed);
              else next.delete("q");
              next.delete("page");
              setParams(next, { replace: true });
            }}
          >
            <div className="min-w-[16rem] flex-1 space-y-2">
              <Label htmlFor="admin-coupon-q">جست‌وجو</Label>
              {/* The wrapper is the LTR island, not just the input: that keeps the
                  icon and the input's padding on the same side, so the glyph can
                  never sit on top of the text. */}
              <div className="relative" dir="ltr">
                <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
                <Input
                  id="admin-coupon-q"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="کد تخفیف"
                  className="ps-9"
                />
              </div>
            </div>

            <Button type="submit" variant="secondary" className="gap-1.5">
              <Search className="size-4" />
              جست‌وجو
            </Button>

            {q !== "" && (
              <Button
                type="button"
                variant="ghost"
                className="gap-1.5"
                onClick={() => {
                  setSearch("");
                  setParams(new URLSearchParams(), { replace: true });
                }}
              >
                <X className="size-4" />
                حذف فیلتر
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-14 rounded-md" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {q ? "کدی با این مشخصات پیدا نشد." : "هنوز کد تخفیفی ساخته نشده است."}
            </p>
          ) : (
            <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>کد</TableHead>
                    <TableHead>تخفیف</TableHead>
                    <TableHead>حداقل خرید</TableHead>
                    <TableHead>استفاده</TableHead>
                    <TableHead>انقضا</TableHead>
                    <TableHead>فعال</TableHead>
                    <TableHead className="text-end">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-bold" dir="ltr">
                        {coupon.code}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {coupon.type === "percent" ? `${formatNumber(coupon.amount)}٪` : formatToman(coupon.amount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {coupon.minOrder > 0 ? formatToman(coupon.minOrder) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatNumber(coupon.usedCount)}
                        {coupon.maxUses > 0 ? ` از ${formatNumber(coupon.maxUses)}` : " (نامحدود)"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {coupon.expiresAt ? formatDate(coupon.expiresAt) : "—"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={coupon.isActive}
                          disabled={update.isPending}
                          aria-label={`فعال بودن کد ${coupon.code}`}
                          onCheckedChange={(checked) =>
                            update.mutate({ id: coupon.id, body: { isActive: checked } })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="ویرایش کد تخفیف"
                          onClick={() => openEdit(coupon)}
                        >
                          <Pencil className="size-4" />
                        </Button>
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
                itemLabel="کد تخفیف"
                onChange={goToPage}
                className="mt-6"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-start">{editing ? "ویرایش کد تخفیف" : "کد تخفیف جدید"}</DialogTitle>
            <DialogDescription className="text-start">
              کد تخفیف در صفحه پرداخت وارد می‌شود و روی جمع کالاها اعمال می‌گردد.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>کد</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        dir="ltr"
                        className="text-start uppercase"
                        placeholder="WELCOME10"
                        onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>نوع تخفیف</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="percent">درصدی</SelectItem>
                          <SelectItem value="fixed">مبلغی</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{type === "percent" ? "درصد تخفیف" : "مبلغ تخفیف"}</FormLabel>
                      <FormControl>
                        {type === "percent" ? (
                          <Input {...field} inputMode="numeric" placeholder="۱۰" />
                        ) : (
                          <MoneyInput {...field} placeholder="50000" />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>حداقل مبلغ سفارش</FormLabel>
                      <FormControl>
                        <MoneyInput {...field} placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxUses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>سقف استفاده</FormLabel>
                      <FormControl>
                        <Input {...field} inputMode="numeric" placeholder="۰ = نامحدود" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تاریخ انقضا</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" className="max-w-52" />
                    </FormControl>
                    <FormDescription>خالی بگذارید تا کد تاریخ انقضا نداشته باشد.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>فعال</FormLabel>
                      <FormDescription>کد غیرفعال در صفحه پرداخت پذیرفته نمی‌شود.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  انصراف
                </Button>
                <Button type="submit" disabled={pending}>
                  {editing ? "ذخیره تغییرات" : "ساخت کد تخفیف"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
