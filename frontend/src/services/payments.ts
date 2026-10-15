import { http } from "@/lib/api";
import type { PaymentStart } from "@/types/api";

/**
 * ZarinPal endpoints.
 *
 * The amount is never sent from here: the server reads it from the stored order,
 * so a tampered client cannot pay less than it owes. This call only says which
 * order to pay for and answers with the page to send the browser to.
 */
export const paymentService = {
  start: (orderId: number) => http.post<PaymentStart>("/payments/request", { orderId }, { auth: true }),
};
