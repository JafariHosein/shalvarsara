import { Link } from "react-router-dom";
import { ShieldCheck, Sparkles, Truck } from "lucide-react";

import { Logo } from "@/components/common/logo";

const HIGHLIGHTS = [
  { icon: Sparkles, text: "۵۰+ مدل شلوار در سه رده سنی" },
  { icon: Truck, text: "ارسال یک‌روزه در تهران و کرج" },
  { icon: ShieldCheck, text: "پرداخت امن از طریق زرین‌پال" },
];

/**
 * Two-column shell for the sign-in and sign-up pages. The brand panel carries
 * the visual weight so the form itself stays calm and readable.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="container grid flex-1 items-center gap-10 py-12 lg:grid-cols-2">
      {/* brand panel */}
      <aside className="relative hidden overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-primary/5 to-background p-10 lg:block">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-16 -top-16 size-64 rounded-full bg-primary/25 blur-3xl"
        />
        <div className="relative space-y-8">
          <Logo />
          <div className="space-y-3">
            <p className="text-2xl font-black leading-9">
              حسابی بسازید که
              <br />
              خرید شلوار را ساده می‌کند.
            </p>
            <p className="max-w-sm text-sm leading-7 text-muted-foreground">
              سابقه سفارش‌ها، آدرس‌های ذخیره‌شده و پیگیری لحظه‌ای ارسال — همه در یک حساب کاربری.
            </p>
          </div>
          <ul className="space-y-3 text-sm">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* form panel */}
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex justify-center lg:hidden">
          <Logo />
        </div>

        <h1 className="text-2xl font-extrabold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}

        <div className="mt-6">{children}</div>

        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

/** Small helper so both auth pages link consistently. */
export function AuthSwitchLink({ to, prefix, label }: { to: string; prefix: string; label: string }) {
  return (
    <span>
      {prefix}{" "}
      <Link to={to} className="font-semibold text-primary hover:underline">
        {label}
      </Link>
    </span>
  );
}
