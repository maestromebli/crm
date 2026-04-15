import * as XLSX from "xlsx";
import type { ContactCategory } from "@prisma/client";

export type ImportedContactRow = {
  fullName: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  category: ContactCategory;
  companyName: string | null;
  companyType: "COMPANY" | "PERSON";
};

function normalizeHeader(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function text(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function maybeText(v: unknown): string | null {
  const t = text(v);
  return t || null;
}

function normalizeCategory(raw: string): ContactCategory {
  const v = raw.toLowerCase();
  if (v.includes("дизайн студ") || v.includes("design studio")) return "DESIGN_STUDIO";
  if (v.includes("дизайнер") || v.includes("designer")) return "DESIGNER";
  if (v.includes("будів") || v.includes("construction")) return "CONSTRUCTION_COMPANY";
  if (v.includes("менедж")) return "MANAGER";
  if (v.includes("кінцев") || v.includes("споживач") || v.includes("customer")) return "END_CUSTOMER";
  if (v.includes("архіт") || v.includes("architect")) return "ARCHITECT";
  if (v.includes("постач") || v.includes("supplier")) return "SUPPLIER";
  return "OTHER";
}

const HEADER_ALIASES = {
  fullName: ["full name", "name", "повне ім", "піб", "контакт", "contact"],
  phone: ["phone", "телефон", "моб", "номер"],
  email: ["email", "e-mail", "пошта", "mail"],
  city: ["city", "місто"],
  country: ["country", "країна"],
  category: ["category", "тип", "статус", "segment", "сегмент"],
  companyName: ["company", "компан", "організац", "organization"],
  companyType: ["company type", "тип компан", "client type", "type"],
} as const;

function findColumnIndex(headers: string[], aliases: readonly string[]): number {
  return headers.findIndex((h) => aliases.some((a) => h.includes(a)));
}

export function parseContactsImportFile(bytes: Buffer): ImportedContactRow[] {
  const wb = XLSX.read(bytes, { type: "buffer" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = wb.Sheets[firstSheetName];
  const rowsRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });
  if (rowsRaw.length === 0) return [];

  const headerKeys = Object.keys(rowsRaw[0] ?? {});
  const headers = headerKeys.map(normalizeHeader);

  const idxFullName = findColumnIndex(headers, HEADER_ALIASES.fullName);
  const idxPhone = findColumnIndex(headers, HEADER_ALIASES.phone);
  const idxEmail = findColumnIndex(headers, HEADER_ALIASES.email);
  const idxCity = findColumnIndex(headers, HEADER_ALIASES.city);
  const idxCountry = findColumnIndex(headers, HEADER_ALIASES.country);
  const idxCategory = findColumnIndex(headers, HEADER_ALIASES.category);
  const idxCompanyName = findColumnIndex(headers, HEADER_ALIASES.companyName);
  const idxCompanyType = findColumnIndex(headers, HEADER_ALIASES.companyType);

  const out: ImportedContactRow[] = [];
  for (const r of rowsRaw) {
    const fullName =
      idxFullName >= 0 ? text(r[headerKeys[idxFullName]]) : text(Object.values(r)[0]);
    if (!fullName) continue;

    const categoryRaw = idxCategory >= 0 ? text(r[headerKeys[idxCategory]]) : "";
    const companyName = idxCompanyName >= 0 ? maybeText(r[headerKeys[idxCompanyName]]) : null;
    const companyTypeRaw = idxCompanyType >= 0 ? text(r[headerKeys[idxCompanyType]]) : "";
    const companyType = companyTypeRaw.toLowerCase().includes("person")
      ? "PERSON"
      : "COMPANY";

    out.push({
      fullName,
      phone: idxPhone >= 0 ? maybeText(r[headerKeys[idxPhone]]) : null,
      email: idxEmail >= 0 ? maybeText(r[headerKeys[idxEmail]]) : null,
      city: idxCity >= 0 ? maybeText(r[headerKeys[idxCity]]) : null,
      country: idxCountry >= 0 ? maybeText(r[headerKeys[idxCountry]]) : null,
      category: normalizeCategory(categoryRaw),
      companyName,
      companyType,
    });
  }

  return out;
}

