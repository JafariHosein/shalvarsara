import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, ExternalLink, Loader2, PackagePlus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ImageManager } from "@/components/admin/image-manager";
import { VariantManager } from "@/components/admin/variant-manager";
import { useAdminCategories, useAdminProduct, useCreateProduct, useDeleteProduct, useUpdateProduct } from "@/hooks/use-admin";
import { errorMessage } from "@/lib/api";
import { toEnDigits } from "@/lib/format";
import { digitsToNumber, productSchema, type ProductFormValues } from "@/lib/schemas";
import type { AdminProductInput } from "@/types/api";

const GENDERS = ["مردانه", "زنانه", "بچگانه"];

const PANT_TYPES = ["جین", "پارچه‌ای", "کتان", "کارگو", "اسلش", "بگ", "اسکینی"];

const EMPTY: ProductFormValues = {
  title: "",
  slug: "",
  categoryId: "",
  brand: "",
  gender: "",
  pantType: "",
  fabric: "",
  shortDesc: "",
  description: "",
  price: "",
  discountPrice: "",
  stock: "0",
  sku: "",
  isActive: true,
  isFeatured: false,
};

/**
 * Create or edit one product. The same screen serves both: `/products/new`
 * starts from empty values, `/products/:id` fills the form from the API and
 * additionally shows the variant and image managers, which need an id.
 */
export function AdminProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const productId = id ? Number(id) : undefined;
  const isEdit = typeof productId === "number" && Number.isFinite(productId) && productId > 0;

  const categories = useAdminCategories();
  const existing = useAdminProduct(isEdit ? productId : undefined);
  const create = useCreateProduct();
  const update = useUpdateProduct(productId ?? 0);
  const remove = useDeleteProduct();

  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: EMPTY,
  });

  const { reset } = form;

  // Fill the form once the product arrives; a create screen keeps its defaults.
  React.useEffect(() => {
    const product = existing.data;
    if (!product) return;
    reset({
      title: product.title,
      slug: product.slug,
      categoryId: String(product.categoryId),
      brand: product.brand,
      gender: product.gender,
      pantType: product.pantType,
      fabric: product.fabric,
      shortDesc: product.shortDesc,
      description: product.description,
      price: String(product.price),
      discountPrice: product.discountPrice != null ? String(product.discountPrice) : "",
      stock: String(product.stock),
      sku: product.sku,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
    });
  }, [existing.data, reset]);

  const pending = create.isPending || update.isPending;

  const onSubmit = (values: ProductFormValues) => {
    const body: AdminProductInput = {
      title: values.title.trim(),
      slug: values.slug.trim(),
      categoryId: Number(values.categoryId),
      brand: values.brand.trim(),
      gender: values.gender.trim(),
      pantType: values.pantType.trim(),
      fabric: values.fabric.trim(),
      shortDesc: values.shortDesc.trim(),
      description: values.description.trim(),
      price: digitsToNumber(values.price),
      // An empty discount means "no discount"; the API clears it on 0.
      discountPrice: values.discountPrice.trim() === "" ? 0 : digitsToNumber(values.discountPrice),
      stock: digitsToNumber(values.stock),
      sku: toEnDigits(values.sku.trim()),
      isActive: values.isActive,
      isFeatured: values.isFeatured,
    };

    if (isEdit) {
      update.mutate(body);
      return;
    }
    create.mutate(body, { onSuccess: (product) => navigate(`/admin/products/${product.id}`, { replace: true }) });
  };

  if (isEdit && existing.isLoading) {
    return (
      <>
        <AdminPageHeader icon={PackagePlus} title="ویرایش محصول" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </>
    );
  }

  if (isEdit && (existing.isError || !existing.data)) {
    return (
      <>
        <AdminPageHeader icon={PackagePlus} title="ویرایش محصول" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="size-7 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {existing.error ? errorMessage(existing.error) : "این محصول پیدا نشد."}
            </p>
            <Button asChild variant="outline">
              <Link to="/admin/products">بازگشت به فهرست محصولات</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  const product = existing.data;

  return (
    <>
      <AdminPageHeader
        icon={PackagePlus}
        title={isEdit ? "ویرایش محصول" : "محصول جدید"}
        description={isEdit ? product?.title : "مشخصات محصول تازه را وارد کنید."}
      >
        <Button asChild variant="ghost" className="gap-1.5">
          <Link to="/admin/products">
            <ArrowRight className="size-4" />
            بازگشت
          </Link>
        </Button>
        {isEdit && product ? (
          <Button asChild variant="outline" className="gap-1.5">
            <Link to={`/products/${product.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              نمایش در فروشگاه
            </Link>
          </Button>
        ) : null}
        <Button type="submit" form="product-form" className="gap-1.5" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          ذخیره
        </Button>
      </AdminPageHeader>

      <Form {...form}>
        <form id="product-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <Card>
              <CardHeader>
                <CardTitle>اطلاعات محصول</CardTitle>
                <CardDescription>عنوان و توضیحات همان چیزی است که مشتری می‌بیند.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>عنوان</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="شلوار جین مردانه مدل اسلیم فیت" />
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
                      <FormLabel>نشانی صفحه (اختیاری)</FormLabel>
                      <FormControl>
                        <Input {...field} dir="ltr" className="text-start" placeholder="shalvar-jeans-men-slim-fit" />
                      </FormControl>
                      <FormDescription>
                        اگر خالی بماند، از روی عنوان ساخته می‌شود. تغییر نشانی، پیوندهای قبلی را از کار
                        می‌اندازد.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>دسته‌بندی</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="انتخاب دسته‌بندی" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(categories.data ?? []).map((category) => (
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
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>برند</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="لوییز" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>گروه سنی/جنسیت</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="انتخاب کنید" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GENDERS.map((gender) => (
                              <SelectItem key={gender} value={gender}>
                                {gender}
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
                    name="pantType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>نوع شلوار</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="انتخاب کنید" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PANT_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
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
                    name="fabric"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>جنس پارچه</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="جین کشی" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="shortDesc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>توضیح کوتاه</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} placeholder="یک یا دو خط برای کارت محصول" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>توضیحات کامل</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={8} placeholder="جزئیات دوخت، جنس، اندازه‌ها و…" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="space-y-6 lg:sticky lg:top-32 lg:self-start">
              <Card>
                <CardHeader>
                  <CardTitle>قیمت و موجودی</CardTitle>
                  <CardDescription>مبالغ به تومان وارد می‌شوند.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>قیمت</FormLabel>
                        <FormControl>
                          <Input {...field} inputMode="numeric" placeholder="۸۹۰۰۰۰" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="discountPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>قیمت با تخفیف</FormLabel>
                        <FormControl>
                          <Input {...field} inputMode="numeric" placeholder="خالی = بدون تخفیف" />
                        </FormControl>
                        <FormDescription>برای برداشتن تخفیف، این فیلد را خالی بگذارید.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>موجودی انبار</FormLabel>
                        <FormControl>
                          <Input {...field} inputMode="numeric" placeholder="۰" />
                        </FormControl>
                        <FormDescription>
                          {product && product.variants.length > 0
                            ? "این محصول گونه دارد؛ موجودی هر گونه جداگانه تعیین می‌شود."
                            : "برای محصولات بدون گونه، همین موجودی ملاک است."}
                        </FormDescription>
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
                          <Input {...field} dir="ltr" className="text-start" placeholder="SS-001" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>وضعیت نمایش</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>فعال</FormLabel>
                          <FormDescription>محصول غیرفعال در فروشگاه نمایش داده نمی‌شود.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isFeatured"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>پیشنهاد ویژه</FormLabel>
                          <FormDescription>در بخش پیشنهادهای صفحه اصلی نمایش داده می‌شود.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {isEdit ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="size-4" />
                      حذف محصول
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>

          {!isEdit && (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                پس از ذخیره محصول، می‌توانید گونه‌ها (اندازه و رنگ) و تصاویر آن را اضافه کنید.
              </CardContent>
            </Card>
          )}
        </form>

        {/* The variant and image managers open dialogs with forms of their own.
            They stay outside <form id="product-form"> on purpose: a submit event
            coming out of a portal still bubbles up the React tree, so a nested
            dialog would save the product as a side effect. */}
        {isEdit && product ? (
          <div className="mt-6 space-y-6">
            <VariantManager product={product} />
            <ImageManager product={product} />
          </div>
        ) : null}
      </Form>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title="حذف محصول"
        confirmLabel="حذف کن"
        isPending={remove.isPending}
        description={
          product ? (
            <>
              محصول «{product.title}» از فروشگاه برداشته می‌شود. سفارش‌های ثبت‌شده دست‌نخورده می‌مانند.
            </>
          ) : null
        }
        onConfirm={() => {
          if (!product) return;
          remove.mutate(product.id, { onSuccess: () => navigate("/admin/products", { replace: true }) });
        }}
      />
    </>
  );
}
