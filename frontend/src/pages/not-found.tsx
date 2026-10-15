import { Link } from "react-router-dom";
import { Home, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

/** 404 page. */
export function NotFoundPage() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
        <SearchX className="size-8" />
      </span>
      <h1 className="text-3xl font-black">۴۰۴ — صفحه پیدا نشد</h1>
      <p className="max-w-md text-sm leading-7 text-muted-foreground">
        نشانی‌ای که وارد کرده‌اید وجود ندارد یا جابه‌جا شده است. می‌توانید از فروشگاه ادامه دهید.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Button asChild className="gap-2">
          <Link to="/">
            <Home className="size-4" />
            صفحه اصلی
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/products">مشاهده محصولات</Link>
        </Button>
      </div>
    </div>
  );
}
