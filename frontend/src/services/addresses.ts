import { http } from "@/lib/api";
import type { Address } from "@/types/api";

export interface AddressPayload {
  receiverName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  line1: string;
  line2?: string;
  /** Map pin. Both are present or both omitted; the backend enforces the pair. */
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
}

export const addressService = {
  list: (signal?: AbortSignal) => http.get<Address[]>("/addresses", { auth: true, signal }),

  create: (payload: AddressPayload) => http.post<Address>("/addresses", payload, { auth: true }),

  update: (id: number, payload: AddressPayload) =>
    http.patch<Address>(`/addresses/${id}`, payload, { auth: true }),

  remove: (id: number) => http.delete<void>(`/addresses/${id}`, { auth: true }),
};
