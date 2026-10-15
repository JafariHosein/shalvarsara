import { useQuery } from "@tanstack/react-query";

import { categoryService } from "@/services/categories";

/** Categories change rarely, so they are cached for the whole session. */
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => categoryService.list(signal),
    staleTime: 10 * 60_000,
  });
}
