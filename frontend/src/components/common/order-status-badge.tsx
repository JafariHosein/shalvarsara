import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/types/api";

/**
 * Colour treatment per status, so a list of orders reads at a glance. Kept in
 * one place because the storefront's order history and the admin panel must not
 * drift apart — a customer and an operator should see the same colour for the
 * same state.
 */
const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  paid: "border-primary/40 bg-primary/10 text-primary",
  processing: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  shipped: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  delivered: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  canceled: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

/** Single-line summary of where an order stands. */
export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("shrink-0", STATUS_STYLES[status] ?? "", className)}>
      {ORDER_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
