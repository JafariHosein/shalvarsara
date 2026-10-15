import { MessageSquareText, Phone, ShieldCheck } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/page-header";

/**
 * SMS panel — not built yet.
 *
 * The pieces that touch SMS already exist: `POST /auth/register/code` issues the
 * six-digit code, stores it in `phone_verifications` and (with
 * `SMS_TEST_MODE=false`) hands it to a provider hook. What is missing is an
 * admin-facing console: templates, sender, delivery log, balance. This page
 * says exactly that instead of showing an empty table.
 */
export function AdminSms() {
  return (
    <div className="space-y-6">
      <AdminPageHeader title="پنل پیامکی" description="ارسال و پیگیری پیامک‌های کد تأیید و اطلاع‌رسانی سفارش." />

      <div className="surface p-8 text-center sm:p-12">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <MessageSquareText className="size-6" strokeWidth={1.75} />
        </span>

        <h2 className="mt-5 text-xl font-extrabold">به‌زودی</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-foreground text-pretty">
          پنل پیامکی روی نقشهٔ راه پروژه است. تا آن زمان، کد تأیید ثبت‌نام سرور
          خودش صادر می‌کند و در نسخهٔ آزمایشی همان صفحه نشان داده می‌شود.
        </p>

        <ul className="mx-auto mt-8 grid max-w-2xl gap-3 text-start sm:grid-cols-3">
          {[
            { title: "قالب پیامک", text: "متن کد تأیید و اطلاع‌رسانی سفارش در یک جا قابل ویرایش باشد." },
            { title: "گزارش ارسال", text: "هر پیامک با شمارهٔ گیرنده، زمان و وضعیت ثبت شود." },
            { title: "اعتبار پنل", text: "موجودی سرویس‌دهنده و هشدار کمبود اعتبار دیده شود." },
          ].map(({ title, text }) => (
            <li key={title} className="rounded-xl bg-muted/50 p-4">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground text-pretty">{text}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="surface p-5">
          <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Phone className="size-4" strokeWidth={1.75} />
          </span>
          <p className="mt-3 text-sm font-semibold">کد تأیید ثبت‌نام</p>
          <p className="mt-1 text-xs leading-6 text-muted-foreground text-pretty">
            کد ۶ رقمی، ۲ دقیقه اعتبار، ۵ تلاش مجاز و یک بار استفاده؛ فاصلهٔ حداقل ۶۰
            ثانیه بین دو درخواست.
          </p>
        </div>

        <div className="surface p-5">
          <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="size-4" strokeWidth={1.75} />
          </span>
          <p className="mt-3 text-sm font-semibold">حالت آزمایشی</p>
          <p className="mt-1 text-xs leading-6 text-muted-foreground text-pretty">
            با <span dir="ltr">SMS_TEST_MODE=true</span> کد در پاسخ API برمی‌گردد؛ برای
            رفتن به اندازهٔ واقعی کافی است آن را خاموش کنید و سرویس‌دهنده را وصل کنید.
          </p>
        </div>
      </div>
    </div>
  );
}
