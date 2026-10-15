import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Header search box; submits to /products?q=... */
export function SearchBar({ className, onSubmitted }: { className?: string; onSubmitted?: () => void }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [value, setValue] = React.useState(params.get("q") ?? "");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const query = value.trim();
    navigate(query ? `/products?q=${encodeURIComponent(query)}` : "/products");
    onSubmitted?.();
  }

  return (
    <form onSubmit={handleSubmit} className={cn("relative w-full", className)} role="search">
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
      <Input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="جست‌وجوی شلوار، برند یا مدل…"
        aria-label="جست‌وجو در محصولات"
        className="h-10 ps-9 pe-20"
      />
      <Button type="submit" size="sm" className="absolute inset-y-1 end-1 my-auto h-8">
        جست‌وجو
      </Button>
    </form>
  );
}
