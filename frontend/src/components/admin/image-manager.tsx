import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Pencil, Plus, Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { SmartImage } from "@/components/common/smart-image";
import { useCreateImage, useDeleteImage, useUpdateImage } from "@/hooks/use-admin";
import { digitsToNumber, imageSchema, type ImageFormValues } from "@/lib/schemas";
import type { AdminImageInput, Product, ProductImage } from "@/types/api";

const EMPTY: ImageFormValues = { url: "", alt: "", isPrimary: false, sortOrder: "0" };

function toFormValues(image: ProductImage): ImageFormValues {
  return {
    url: image.url,
    alt: image.alt,
    isPrimary: image.isPrimary,
    sortOrder: String(image.sortOrder),
  };
}

/** Gallery of a product: add, edit, reorder and pick the primary image. */
export function ImageManager({ product }: { product: Product }) {
  const create = useCreateImage(product.id);
  const update = useUpdateImage();
  const remove = useDeleteImage();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProductImage | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<ProductImage | null>(null);

  const form = useForm<ImageFormValues>({ resolver: zodResolver(imageSchema), defaultValues: EMPTY });

  const openCreate = () => {
    setEditing(null);
    form.reset({ ...EMPTY, isPrimary: product.images.length === 0 });
    setOpen(true);
  };

  const openEdit = (image: ProductImage) => {
    setEditing(image);
    form.reset(toFormValues(image));
    setOpen(true);
  };

  const onSubmit = (values: ImageFormValues) => {
    const body: AdminImageInput = {
      url: values.url.trim(),
      alt: values.alt.trim(),
      isPrimary: values.isPrimary,
      sortOrder: digitsToNumber(values.sortOrder),
    };

    const done = { onSuccess: () => setOpen(false) };
    if (editing) update.mutate({ id: editing.id, body }, done);
    else create.mutate(body, done);
  };

  const images = [...product.images].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder || a.id - b.id,
  );
  const pending = create.isPending || update.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <ImagePlus className="size-4 text-primary" />
            تصاویر
          </CardTitle>
          <CardDescription>تصویر اصلی در فهرست محصولات و کارت محصول نمایش داده می‌شود.</CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="size-4" />
          افزودن
        </Button>
      </CardHeader>
      <CardContent>
        {images.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">هنوز تصویری برای این محصول ثبت نشده است.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {images.map((image) => (
              <div key={image.id} className="overflow-hidden rounded-lg border bg-card">
                <div className="relative">
                  <SmartImage
                    src={image.url}
                    alt={image.alt || product.title}
                    wrapperClassName="aspect-[4/5] w-full"
                  />
                  {image.isPrimary ? (
                    <Badge className="absolute start-2 top-2 gap-1">
                      <Star className="size-3" />
                      تصویر اصلی
                    </Badge>
                  ) : null}
                </div>
                <div className="space-y-1 p-2.5">
                  <p className="line-clamp-1 text-[11px] text-muted-foreground" dir="ltr">
                    {image.url}
                  </p>
                  <p className="line-clamp-1 text-xs">{image.alt || "بدون متن جایگزین"}</p>
                  <div className="flex items-center justify-end gap-1 pt-1">
                    {!image.isPrimary && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1 px-2 text-xs"
                        onClick={() =>
                          update.mutate({
                            id: image.id,
                            body: {
                              url: image.url,
                              alt: image.alt,
                              isPrimary: true,
                              sortOrder: image.sortOrder,
                            },
                          })
                        }
                      >
                        <Star className="size-3.5" />
                        اصلی کن
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="ویرایش تصویر"
                      onClick={() => openEdit(image)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="حذف تصویر"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setPendingDelete(image)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-start">{editing ? "ویرایش تصویر" : "افزودن تصویر"}</DialogTitle>
            <DialogDescription className="text-start">
              نشانی تصویر را از میزبان فایل‌های خود کپی کنید (نشانی باید با http یا https شروع شود).
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نشانی تصویر</FormLabel>
                    <FormControl>
                      <Input {...field} dir="ltr" className="text-start" placeholder="https://…/image.jpg" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="alt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>متن جایگزین</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="شلوار کتان مردانه مشکی" />
                    </FormControl>
                    <FormDescription>برای دسترس‌پذیری و سئو نوشته می‌شود.</FormDescription>
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
                      <Input {...field} inputMode="numeric" className="max-w-32" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPrimary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>تصویر اصلی</FormLabel>
                      <FormDescription>با انتخاب این گزینه، تصویر اصلی قبلی کنار گذاشته می‌شود.</FormDescription>
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
                  {editing ? "ذخیره تصویر" : "افزودن تصویر"}
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
        title="حذف تصویر"
        confirmLabel="حذف کن"
        isPending={remove.isPending}
        description="این تصویر از گالری محصول برداشته می‌شود."
        onConfirm={() => {
          if (!pendingDelete) return;
          remove.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
        }}
      />
    </Card>
  );
}
