import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AuthShell, AuthSwitchLink } from "@/components/layout/auth-shell";
import { ApiError, errorMessage } from "@/lib/api";
import { loginSchema, type LoginValues } from "@/lib/schemas";
import { useAuthStore, useIsAuthenticated } from "@/store/auth-store";

/** Sign-in page. */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useIsAuthenticated();

  // Where to go after a successful sign-in (set by ProtectedRoute).
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Someone already signed in has no business on this page.
  React.useEffect(() => {
    if (isAuthenticated) navigate(redirectTo, { replace: true });
  }, [isAuthenticated, navigate, redirectTo]);

  async function onSubmit(values: LoginValues) {
    try {
      const user = await login(values);
      toast.success(`خوش آمدید، ${user.name}!`);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.details) {
        for (const [field, message] of Object.entries(error.details)) {
          if (field === "email" || field === "password") {
            form.setError(field, { message });
          }
        }
      }
      form.setError("root", { message: errorMessage(error) });
    }
  }

  const submitting = form.formState.isSubmitting;

  return (
    <AuthShell
      title="ورود به حساب کاربری"
      description="برای پیگیری سفارش‌ها و ثبت سفارش جدید وارد شوید."
      footer={<AuthSwitchLink to="/register" prefix="حساب ندارید؟" label="ثبت‌نام کنید" />}
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
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>رمز عبور</FormLabel>
                <FormControl>
                  <Input {...field} type="password" dir="ltr" autoComplete="current-password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" size="lg" className="w-full gap-2" disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            ورود
          </Button>

          <div className="space-y-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">حساب‌های آزمایشی</p>
            <p className="flex flex-wrap items-center gap-1">
              <span>مشتری:</span>
              <span dir="ltr" className="font-medium">
                customer@example.com / Customer@12345
              </span>
            </p>
            <p className="flex flex-wrap items-center gap-1">
              <span>مدیر:</span>
              <span dir="ltr" className="font-medium">
                admin@example.com / Admin@12345
              </span>
            </p>
          </div>
        </form>
      </Form>

      <div className="mt-4 text-center">
        <Link to="/products" className="text-sm text-muted-foreground hover:text-primary">
          فعلاً فقط می‌خواهم خرید کنم
        </Link>
      </div>
    </AuthShell>
  );
}
