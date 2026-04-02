import { EntryStatus } from "@/lib/types";

export const formatCurrency = (amount: number) =>
  amount.toLocaleString("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0
  });

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

export const statusClassName = (status: EntryStatus) => {
  if (status === "Submitted") return "status-submitted";
  if (status === "Reviewed") return "status-reviewed";
  return "status-draft";
};

export const calcVariance = (budget: number, expense: number) => {
  if (!budget) return 0;
  return ((budget - expense) / budget) * 100;
};

export const calcUtilization = (budget: number, expense: number) => {
  if (!budget) return 0;
  return (expense / budget) * 100;
};

export const genUniqueId = (date: Date, serial: number) => {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const sr = String(serial).padStart(2, "0");
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PR-${yy}${mm}${dd}-${sr}-${randomSuffix}`;
};

export const normalizeText = (value: string) => value.trim().toLowerCase();