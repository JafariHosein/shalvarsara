import { http } from "@/lib/api";
import type { CategoryWithCount } from "@/types/api";

export const categoryService = {
  list: (signal?: AbortSignal) => http.get<CategoryWithCount[]>("/categories", { signal }),
};
