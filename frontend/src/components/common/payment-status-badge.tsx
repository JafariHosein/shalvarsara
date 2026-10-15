import { Badge } from "@/components/ui/badge";
import type { PaymentStatus } from "@/types/api";

/**
 * Payment status label + colour in one place.
 *
 * Both the admin order screen and the transactions table read from here, so the
 * two can never disagree about what «پرداخت موفق» looks like. Colours are
 * deliberately close to the order palette: success reads green, failure reads
 * red, "waiting" reads amber.
 */
const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  initiated: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  verified: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  initiated: "در انتظار پرداخت",
  verified: "پرداخت موفق",
  failed: "پرداخت ناموفق",
};

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  /** Overrides the built-in label — the backend already sends a Persian one. */
  label?: string;
  className?: string;
}

export function PaymentStatusBadge({ status, label, className }: PaymentStatusBadgeProps) {
  return (
    <Badge variant="outline" className={className ?? PAYMENT_STYLES[status]}>
      {label ?? PAYMENT_LABELS[status]}
    </Badge>
  );
}
