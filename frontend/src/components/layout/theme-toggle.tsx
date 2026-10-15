import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/theme-provider";

/**
 * Light/dark switch.
 *
 * The very first visit follows the operating system (that default lives in the
 * theme provider), but the visitor only ever sees two states: the moment the
 * switch is used the choice becomes explicit and sticks.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  const label = next === "dark" ? "حالت تاریک" : "حالت روشن";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => setTheme(next)}
    >
      <Sun className="size-5 dark:hidden" />
      <Moon className="hidden size-5 dark:block" />
    </Button>
  );
}
