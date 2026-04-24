import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// قراءة كل المشتركين
export function useCustomers() {
  return useQuery(api.customers.list);
}

// إضافة مشترك
export function useCreateCustomer() {
  return useMutation(api.customers.create);
}

// تعديل مشترك
export function useUpdateCustomer() {
  return useMutation(api.customers.update);
}
