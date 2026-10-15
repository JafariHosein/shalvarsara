import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, MapPin, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/common/empty-state";
import { toEnDigits } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { addressService, type AddressPayload } from "@/services/addresses";

const digitsOnly = (value: string) => toEnDigits(value).replace(/[^\d]/g, "");

const addressSchema = z.object({
  receiverName: z.string().trim().min(2, "نام گیرنده را وارد کنید."),
  phone: z
    .string()
    .transform(digitsOnly)
    .refine((value) => /^09\d{9}$/.test(value), { message: "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود." }),
  province: z.string().trim().min(2, "استان را وارد کنید."),
  city: z.string().trim().min(2, "شهر را وارد کنید."),
  postalCode: z
    .string()
    .transform(digitsOnly)
    .refine((value) => /^\d{10}$/.test(value), { message: "کد پستی باید ۱۰ رقم باشد." }),
  line1: z.string().trim().min(5, "نشانی را کامل‌تر وارد کنید."),
  line2: z.string().trim().max(255).optional().or(z.literal("")),
  isDefault: z.boolean(),
});

type AddressValues = z.infer<typeof addressSchema>;

const EMPTY: AddressValues = {
  receiverName: "",
  phone: "",
  province: "",
  city: "",
  postalCode: "",
  line1: "",
  line2: "",
  isDefault: false,
};

/** Dialog for adding a new shipping address. Also used by the checkout page. */
export function AddressDialog({ trigger }: { trigger?: React.ReactNode } = {}) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: EMPTY,
  });

  const create = useMutation({
    mutationFn: (payload: AddressPayload) => addressService.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("آدرس جدید ثبت شد.");
      setOpen(false);
      form.reset(EMPTY);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function onSubmit(values: AddressValues) {
    create.mutate(values as AddressPayload);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset(EMPTY);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <Plus className="size-4" />
            افزودن آدرس
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>آدرس جدید</DialogTitle>
          <DialogDescription>این آدرس برای ارسال سفارش‌ها استفاده می‌شود.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="receiverName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نام گیرنده</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="مثلاً سارا محمدی" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>شماره تماس</FormLabel>
                    <FormControl>
                      <Input {...field} dir="ltr" inputMode="tel" className="text-start" placeholder="09123456789" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>استان</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="تهران" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>شهر</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="تهران" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>کد پستی</FormLabel>
                  <FormControl>
                    <Input {...field} dir="ltr" inputMode="numeric" className="text-start" placeholder="1234567890" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="line1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نشانی</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="خیابان، کوچه، پلاک، واحد" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="line2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نشانی تکمیلی (اختیاری)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="توضیحات اضافه برای پیک" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="cursor-pointer">آدرس پیش‌فرض من باشد</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={create.isPending} className="gap-2">
                {create.isPending && <Loader2 className="size-4 animate-spin" />}
                ذخیره آدرس
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** Address book tab: list, add and delete shipping addresses. */
export function AddressesTab() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["addresses"],
    queryFn: ({ signal }) => addressService.list(signal),
  });

  const remove = useMutation({
    mutationFn: (id: number) => addressService.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("آدرس حذف شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">آدرس‌های من</h2>
          <p className="text-sm text-muted-foreground">آدرس‌هایی که برای ارسال سفارش استفاده می‌شوند.</p>
        </div>
        <AddressDialog />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
        </div>
      ) : isError ? (
        <EmptyState title="بارگذاری آدرس‌ها ناموفق بود" description="لطفاً صفحه را دوباره بارگذاری کنید." />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="هنوز آدرسی ثبت نکرده‌اید"
          description="برای ثبت سفارش، حداقل یک آدرس تحویل لازم است."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((address) => (
            <article key={address.id} className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 font-semibold">
                  <MapPin className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{address.receiverName}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {address.isDefault && <Badge variant="secondary">پیش‌فرض</Badge>}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-me-1 -mt-1 size-8 text-muted-foreground hover:text-destructive"
                    aria-label="حذف آدرس"
                    title="حذف آدرس"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(address.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <p className="text-sm leading-7 text-muted-foreground">
                {address.province}، {address.city}، {address.line1}
                {address.line2 ? `، ${address.line2}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span dir="ltr">{address.phone}</span>
                <span>
                  کد پستی: <span dir="ltr">{address.postalCode}</span>
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
