import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageSquare, Send, UserPlus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AuthShell, AuthSwitchLink } from "@/components/layout/auth-shell";
import { ApiError, errorMessage } from "@/lib/api";
import { toEnDigits, toFaDigits } from "@/lib/format";
import { registerSchema, type RegisterValues } from "@/lib/schemas";
import { authService } from "@/services/auth";
import { useAuthStore, useIsAuthenticated } from "@/store/auth-store";

/** Seconds the customer must wait before asking for another code. */
const RESEND_SECONDS = 60;

/** A code that was requested for one specific number. */
interface SentCode {
  phone: string;
  /** Present only while the API has no SMS panel wired in. */
  testMode: boolean;
  code?: string;
  expiresInSeconds: number;
}

/** Sign-up page: details, a code sent to the mobile, then the account. */
export function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const isAuthenticated = useIsAuthenticated();

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      code: "",
      password: "",
      confirmPassword: "",
    },
  });

  const [sent, setSent] = React.useState<SentCode | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  const phone = form.watch("phone");
  const phoneDigits = React.useMemo(() => toEnDigits(phone).replace(/[^\d]/g, ""), [phone]);
  const phoneReady = /^09\d{9}$/.test(phoneDigits);
  // A code only counts for the number it was requested for; editing the number
  // invalidates it instead of silently keeping a stale code around.
  const codeForThisPhone = sent !== null && sent.phone === phoneDigits;

  React.useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  // Resend countdown, one tick at a time.
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const requestCode = useMutation({
    mutationFn: (value: string) => authService.requestRegisterCode({ phone: value }),
    onSuccess: (data) => {
      setSent({
        phone: data.phone,
        testMode: data.testMode,
        code: data.code,
        expiresInSeconds: data.expiresInSeconds,
      });
      setCooldown(RESEND_SECONDS);
      form.setValue("code", "");
      toast.success(data.message);
    },
    onError: (error) => {
      const message = errorMessage(error);
      // Everything this endpoint refuses is about the number itself, except the
      // "slow down" case which is not a field problem.
      if (error instanceof ApiError && (error.status === 409 || error.status === 422)) {
        form.setError("phone", { message });
        return;
      }
      toast.error(message);
    },
  });

  function sendCode() {
    if (!phoneReady) {
      form.setError("phone", { message: "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود." });
      return;
    }
    requestCode.mutate(phoneDigits);
  }

  async function onSubmit(values: RegisterValues) {
    if (!codeForThisPhone) {
      form.setError("code", { message: "ابتدا برای این شماره کد تأیید بگیرید." });
      return;
    }

    try {
      const user = await register({
        name: values.name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        code: values.code,
      });
      toast.success(`حساب شما ساخته شد، ${user.name}!`);
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        // 409 = this email is already registered.
        if (error.details) {
          for (const [field, message] of Object.entries(error.details)) {
            if (field in form.getValues()) {
              form.setError(field as keyof RegisterValues, { message });
            }
          }
        }
        if (error.status === 409) {
          form.setError("email", { message: "این ایمیل قبلاً ثبت شده است." });
        }
        // A wrong or expired code deserves to land on the code field itself.
        if (error.status === 422 && !error.details) {
          form.setError("code", { message: errorMessage(error) });
        }
      }
      form.setError("root", { message: errorMessage(error) });
    }
  }

  const submitting = form.formState.isSubmitting;
  const sending = requestCode.isPending;
  const sendLabel = sending
    ? "ارسال"
    : cooldown > 0
      ? `ارسال دوباره (${toFaDigits(cooldown)})`
      : codeForThisPhone
        ? "ارسال دوباره"
        : "ارسال کد";

  return (
    <AuthShell
      title="ساخت حساب کاربری"
      description="با شماره موبایل ثبت‌نام کنید و خرید را شروع کنید."
      footer={<AuthSwitchLink to="/login" prefix="قبلاً ثبت‌نام کرده‌اید؟" label="وارد شوید" />}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {form.formState.errors.root && (
            <Alert variant="destructive">
              <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>نام و نام خانوادگی</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="name" placeholder="مثلاً سارا محمدی" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ایمیل</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="text-start"
                  />
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
                <FormLabel>شماره موبایل</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="tel"
                      dir="ltr"
                      autoComplete="tel"
                      placeholder="09123456789"
                      className="text-start"
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0 gap-1.5"
                    disabled={sending || !phoneReady || cooldown > 0}
                    onClick={sendCode}
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    {sendLabel}
                  </Button>
                </div>
                <FormDescription>
                  برای پیگیری سفارش و اطلاع‌رسانی ارسال؛ کد تأیید به همین شماره فرستاده می‌شود.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {codeForThisPhone && sent ? (
            <>
              {sent.testMode && sent.code ? (
                <Alert className="border-primary/40 bg-primary/5">
                  <MessageSquare className="text-primary" />
                  <AlertTitle>کد تأیید شما</AlertTitle>
                  <AlertDescription>
                    <p className="text-2xl font-bold tracking-[0.3em] text-primary" dir="ltr">
                      {sent.code}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">
                      این نسخهٔ آزمایشی است و هنوز به پنل پیامکی وصل نیستیم؛ به همین دلیل کد به‌جای
                      پیامک، روی همین صفحه نمایش داده می‌شود. پس از اتصال پنل پیامکی، کد فقط برای
                      شما پیامک خواهد شد.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      اعتبار کد: {formatValidity(sent.expiresInSeconds)}
                    </p>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="success">
                  <CheckCircle2 />
                  <AlertTitle>کد ارسال شد</AlertTitle>
                  <AlertDescription>
                    پیامک کد تأیید به شماره <span dir="ltr">{toFaDigits(sent.phone)}</span> فرستاده شد.
                    اعتبار کد: {formatValidity(sent.expiresInSeconds)}
                  </AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>کد تأیید ۶ رقمی</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="numeric"
                        dir="ltr"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="- - - - - -"
                        className="text-center tracking-[0.5em]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : (
            <p className="rounded-md bg-muted/60 p-3 text-xs leading-6 text-muted-foreground">
              {sent
                ? "شماره موبایل را تغییر داده‌اید؛ برای ادامه، کد تأیید را برای شمارهٔ جدید بگیرید."
                : "برای دریافت کد تأیید، شماره موبایل خود را وارد کنید و «ارسال کد» را بزنید."}
            </p>
          )}

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>رمز عبور</FormLabel>
                <FormControl>
                  <Input {...field} type="password" dir="ltr" autoComplete="new-password" />
                </FormControl>
                <FormDescription>حداقل ۸ کاراکتر.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>تکرار رمز عبور</FormLabel>
                <FormControl>
                  <Input {...field} type="password" dir="ltr" autoComplete="new-password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            className="w-full gap-2"
            disabled={submitting || !codeForThisPhone}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            ثبت‌نام
          </Button>

          <p className="text-center text-xs leading-6 text-muted-foreground">
            با ثبت‌نام، قوانین و شرایط استفاده از شلوارسرا را می‌پذیرید.
          </p>
        </form>
      </Form>
    </AuthShell>
  );
}

/** "۲ دقیقه" — the lifetime a fresh code was given by the API. */
function formatValidity(seconds: number): string {
  if (seconds <= 0) return "نامشخص";
  const minutes = Math.round(seconds / 60);
  return minutes >= 1 ? `${toFaDigits(minutes)} دقیقه` : `${toFaDigits(seconds)} ثانیه`;
}
