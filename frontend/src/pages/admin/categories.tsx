import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPageHeader } from "@/components/admin/page-header";
import { useAdminCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from "@/hooks/use-admin";
import { formatNumber, toFaDigits } from "@/lib/format";
import { adminCategorySchema, digitsToNumber, type AdminCategoryFormValues } from "@/lib/schemas";
import type { AdminCategoryInput, CategoryWithCount } from "@/types/api";

const ROOT = "none";

const EMPTY: AdminCategoryFormValues = { name: "", slug: "", parentId: ROOT, sortOrder: "0" };

function toFormValues(category: CategoryWithCount): AdminCategoryFormValues {
  return {
    name: category.name,
    slug: category.slug,
    parentId: category.parentId ? String(category.parentId) : ROOT,
    sortOrder: String(category.sortOrder),
  };
}

/** The catalogue's categories: create, rename, reorder, delete. */
export function AdminCategories() {
  const { data, isLoading } = useAdminCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CategoryWithCount | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<CategoryWithCount | null>(null);

  const form = useForm<AdminCategoryFormValues>({
    resolver: zodResolver(adminCategorySchema),
    defaultValues: EMPTY,
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(EMPTY);
    setOpen(true);
  };

  const openEdit = (category: CategoryWithCount) => {
    setEditing(category);
    form.reset(toFormValues(category));
    setOpen(true);
  };

  const onSubmit = (values: AdminCategoryFormValues) => {
    const body: AdminCategoryInput = {
      name: values.name.trim(),
      slug: values.slug.trim(),
      parentId: values.parentId === ROOT ? null : Number(values.parentId),
      sortOrder: digitsToNumber(values.sortOrder),
    };

    const done = { onSuccess: () => setOpen(false) };
    if (editing) update.mutate({ id: editing.id, body }, done);
    else create.mutate(body, done);
  };

  const categories = [...(data ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fa"),
  );

  const nameOf = (id?: number) => categories.find((category) => category.id === id)?.name;

  const pending = create.isPending || update.isPending;

  return (
    <>
      <AdminPageHeader
        icon={FolderTree}
        title="دسته‌بندی‌ها"
        description={data ? `${formatNumber(data.length)} دسته‌بندی` : "دسته‌بندی‌های فروشگاه"}
      >
        <Button className="gap-1.5" onClick={openCreate}>
          <Plus className="size-4" />
          دسته‌بندی جدید
        </Button>
      </AdminPageHeader>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-14 rounded-md" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">هنوز دسته‌بندی‌ای ساخته نشده است.</p>
          ) : (
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>شناسه</TableHead>
                  <TableHead>دسته والد</TableHead>
                  <TableHead>ترتیب</TableHead>
                  <TableHead>محصولات</TableHead>
                  <TableHead className="text-end">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{toFaDigits(category.name)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground" dir="ltr">
                      {category.slug}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {category.parentId ? (nameOf(category.parentId) ?? "—") : "—"}
                    </TableCell>
                    <TableCell>{formatNumber(category.sortOrder)}</TableCell>
                    <TableCell>{formatNumber(category.productCount)}</TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="ویرایش دسته‌بندی"
                          onClick={() => openEdit(category)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="حذف دسته‌بندی"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete(category)}
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
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-start">
              {editing ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}
            </DialogTitle>
            <DialogDescription className="text-start">
              نام دسته‌بندی در منوی فروشگاه و صفحه محصولات دیده می‌شود.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نام</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="شلوار مردانه" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>شناسه صفحه (اختیاری)</FormLabel>
                    <FormControl>
                      <Input {...field} dir="ltr" className="text-start" placeholder="men" />
                    </FormControl>
                    <FormDescription>
                      اگر خالی بماند، از روی نام ساخته می‌شود. برای پایداری پیوندها بهتر است انگلیسی باشد.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="parentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>دسته والد</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={ROOT}>بدون والد</SelectItem>
                          {categories
                            .filter((category) => category.id !== editing?.id)
                            .map((category) => (
                              <SelectItem key={category.id} value={String(category.id)}>
                                {category.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ترتیب نمایش</FormLabel>
                      <FormControl>
                        <Input {...field} inputMode="numeric" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  انصراف
                </Button>
                <Button type="submit" disabled={pending}>
                  {editing ? "ذخیره تغییرات" : "ساخت دسته‌بندی"}
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
        title="حذف دسته‌بندی"
        confirmLabel="حذف کن"
        isPending={remove.isPending}
        description={
          pendingDelete ? (
            <>
              دسته‌بندی «{pendingDelete.name}» با {formatNumber(pendingDelete.productCount)} محصول در آن حذف
              می‌شود. اگر محصولی در این دسته باشد، حذف انجام نمی‌شود.
            </>
          ) : null
        }
        onConfirm={() => {
          if (!pendingDelete) return;
          remove.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
        }}
      />
    </>
  );
}
