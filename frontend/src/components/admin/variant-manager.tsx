import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useCreateVariant, useDeleteVariant, useUpdateVariant } from "@/hooks/use-admin";
import { formatNumber, formatToman, toEnDigits, toFaDigits } from "@/lib/format";
import { digitsToNumber, variantSchema, type VariantFormValues } from "@/lib/schemas";
import type { AdminVariantInput, Product, ProductVariant } from "@/types/api";

const EMPTY: VariantFormValues = { size: "", color: "", colorHex: "", stock: "", sku: "", extraPrice: "" };

function toFormValues(variant: ProductVariant): VariantFormValues {
  return {
    size: variant.size,
    color: variant.color,
    colorHex: variant.colorHex,
    stock: String(variant.stock),
    sku: variant.sku,
    extraPrice: String(variant.extraPrice),
  };
}

/** Sizes sort naturally ("30" before "100"), colours alphabetically. */
function bySize(a: ProductVariant, b: ProductVariant): number {
  const size = a.size.localeCompare(b.size, "en", { numeric: true });
  return size !== 0 ? size : a.color.localeCompare(b.color, "fa");
}

/**
 * Size/colour combinations of a product. The variant row — not the product's
 * own stock — is what checkout decrements once a product has variants.
 */
export function VariantManager({ product }: { product: Product }) {
  const create = useCreateVariant(product.id);
  const update = useUpdateVariant();
  const remove = useDeleteVariant();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProductVariant | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<ProductVariant | null>(null);

  const form = useForm<VariantFormValues>({
    resolver: zodResolver(variantSchema),
    defaultValues: EMPTY,
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(EMPTY);
    setOpen(true);
  };

  const openEdit = (variant: ProductVariant) => {
    setEditing(variant);
    form.reset(toFormValues(variant));
    setOpen(true);
  };

  const onSubmit = (values: VariantFormValues) => {
    const body: AdminVariantInput = {
      size: toEnDigits(values.size.trim()),
      color: values.color.trim(),
      colorHex: values.colorHex.trim(),
      stock: digitsToNumber(values.stock),
      sku: toEnDigits(values.sku.trim()),
      extraPrice: digitsToNumber(values.extraPrice),
    };

    const done = { onSuccess: () => setOpen(false) };
    if (editing) update.mutate({ id: editing.id, body }, done);
    else create.mutate(body, done);
  };

  const variants = [...product.variants].sort(bySize);
  const pending = create.isPending || update.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            گونه‌ها
          </CardTitle>
          <CardDescription>
            برای هر اندازه و رنگ، موجودی جدا نگه داشته می‌شود. اگر محصول گونه داشته باشد، موجودی خودِ
            محصول نادیده گرفته می‌شود.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="size-4" />
          افزودن
        </Button>
      </CardHeader>
      <CardContent>
        {variants.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            هنوز گونهی ثبت نشده است؛ محصول با موجودی کل فروخته می‌شود.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اندازه</TableHead>
                <TableHead>رنگ</TableHead>
                <TableHead>موجودی</TableHead>
                <TableHead>اختلاف قیمت</TableHead>
                <TableHead>کد کالا</TableHead>
                <TableHead className="text-end">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => (
                <TableRow key={variant.id}>
                  <TableCell className="font-medium">{toFaDigits(variant.size)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-4 shrink-0 rounded-full border"
                        style={{ backgroundColor: variant.colorHex || "#000000" }}
                      />
                      {toFaDigits(variant.color)}
                    </span>
                  </TableCell>
                  <TableCell className={variant.stock === 0 ? "text-destructive" : undefined}>
                    {formatNumber(variant.stock)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {variant.extraPrice > 0 ? `+${formatToman(variant.extraPrice)}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground" dir="ltr">
                    {variant.sku || "—"}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="ویرایش گونه"
                        onClick={() => openEdit(variant)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="حذف گونه"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPendingDelete(variant)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-start">{editing ? "ویرایش گونه" : "افزودن گونه"}</DialogTitle>
            <DialogDescription className="text-start">
              اندازه و رنگ با هم یک گونه یکتا می‌سازند.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
              <FormField
                control={form.control}
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اندازه</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="۳۲ یا S" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رنگ</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="مشکی" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="colorHex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>کد رنگ</FormLabel>
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-9 shrink-0 rounded-md border"
                        style={{
                          backgroundColor: /^#?[0-9a-fA-F]{3,8}$/.test(field.value) ? field.value : "#000000",
                        }}
                      />
                      <FormControl>
                        <Input {...field} dir="ltr" className="text-start" placeholder="#111111" />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>موجودی</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="numeric" placeholder="۰" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="extraPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اختلاف قیمت (تومان)</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="numeric" placeholder="۰" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>کد کالا</FormLabel>
                    <FormControl>
                      <Input {...field} dir="ltr" className="text-start" placeholder="SS-001-32-BLK" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 sm:col-span-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  انصراف
                </Button>
                <Button type="submit" disabled={pending}>
                  {editing ? "ذخیره گونه" : "افزودن گونه"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(value) => !value && setPendingDelete(null)}
        destructive
        title="حذف گونه"
        confirmLabel="حذف کن"
        isPending={remove.isPending}
        description={
          pendingDelete ? (
            <>
              گونه «{toFaDigits(pendingDelete.size)} — {toFaDigits(pendingDelete.color)}» حذف می‌شود. سفارش‌های
              قبلی که این گونه را داشته‌اند دست‌نخورده می‌مانند.
            </>
          ) : null
        }
        onConfirm={() => {
          if (!pendingDelete) return;
          remove.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
        }}
      />
    </Card>
  );
}
