import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { groupDigits } from "@/lib/pagination";
import { toEnDigits } from "@/lib/format";

export interface MoneyInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> {
  /** Digit-only value (Latin, no separators) — exactly what the API expects. */
  value: string;
  /** Receives the digit-only value, so `{...field}` from react-hook-form works as-is. */
  onChange: (value: string) => void;
  /**
   * Unit shown inside the field. Defaults to «تومان»; pass `null` when the
   * surrounding label already states the currency.
   */
  suffix?: string | null;
}

/**
 * Money field: groups digits in threes as they are typed (`890000` → `890,000`)
 * and shows the currency inside the box. The value handed to the form is always
 * bare digits, so validation and the API stay unchanged.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, suffix = "تومان", className, ...props }, ref) => {
    const display = groupDigits(value);

    return (
      // Numbers read left-to-right even inside the RTL form, so the whole field
      // is an LTR island: the digits align to the right like every other input,
      // while the caret and the separators behave predictably.
      <div dir="ltr" className="relative">
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          // `ps-*` reserves room for the unit so long numbers never slide under it.
          className={cn("text-end tabular-nums", suffix ? "ps-16" : undefined, className)}
          value={display}
          onChange={(event) => onChange(toEnDigits(event.target.value).replace(/\D/g, ""))}
        />
        {suffix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-xs font-medium text-muted-foreground"
          >
            {suffix}
          </span>
        ) : null}
      </div>
    );
  },
);
MoneyInput.displayName = "MoneyInput";
