import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategories } from "@/hooks/use-categories";
import { toEnDigits } from "@/lib/format";
import { SORT_LABELS, type ProductSort } from "@/types/api";

export interface ProductFilters {
  q: string;
  category: string;
  sort: ProductSort;
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
}

export const EMPTY_FILTERS: ProductFilters = {
  q: "",
  category: "",
  sort: "newest",
  minPrice: "",
  maxPrice: "",
  inStock: false,
};

interface FilterPanelProps {
  value: ProductFilters;
  onChange: (patch: Partial<ProductFilters>) => void;
  onReset: () => void;
}

const ALL = "__all__";

/** Sidebar filters for the catalogue page. All state lives in the URL. */
export function FilterPanel({ value, onChange, onReset }: FilterPanelProps) {
  const { data: categories } = useCategories();

  function handlePrice(field: "minPrice" | "maxPrice", raw: string) {
    // Accept Persian digits and strip grouping separators before storing.
    const normalized = toEnDigits(raw).replace(/[^\d]/g, "");
    onChange({ [field]: normalized });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">فیلترها</h2>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={onReset}>
          <RotateCcw className="size-3.5" />
          حذف فیلترها
        </Button>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="filter-category">دسته‌بندی</Label>
        <Select
          value={value.category || ALL}
          onValueChange={(next) => onChange({ category: next === ALL ? "" : next })}
        >
          <SelectTrigger id="filter-category">
            <SelectValue placeholder="همه دسته‌ها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>همه دسته‌ها</SelectItem>
            {(categories ?? []).map((category) => (
              <SelectItem key={category.id} value={category.slug}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-sort">ترتیب نمایش</Label>
        <Select value={value.sort} onValueChange={(next) => onChange({ sort: next as ProductSort })}>
          <SelectTrigger id="filter-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>محدوده قیمت (تومان)</Label>
        <div className="flex items-center gap-2">
          <Input
            inputMode="numeric"
            placeholder="از"
            aria-label="حداقل قیمت"
            value={value.minPrice}
            onChange={(event) => handlePrice("minPrice", event.target.value)}
          />
          <span className="text-muted-foreground">تا</span>
          <Input
            inputMode="numeric"
            placeholder="تا"
            aria-label="حداکثر قیمت"
            value={value.maxPrice}
            onChange={(event) => handlePrice("maxPrice", event.target.value)}
          />
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <Label htmlFor="filter-instock" className="cursor-pointer">
          فقط کالاهای موجود
        </Label>
        <Switch
          id="filter-instock"
          checked={value.inStock}
          onCheckedChange={(checked) => onChange({ inStock: checked })}
        />
      </div>
    </div>
  );
}
