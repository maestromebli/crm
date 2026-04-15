import { prisma } from "../../../lib/prisma";
import { supplierRegistry } from "../core/supplierRegistry";
import type { SupplierProvider } from "../core/supplierTypes";
import { mapMaterialCatalogToSupplierItem } from "../services/supplierMappers";

const manualProvider: SupplierProvider = {
  key: "MANUAL",
  label: "Manual",
  async search({ query, limit = 20 }) {
    const q = query.trim();
    if (!q) return [];
    const rows = await prisma.materialCatalogItem.findMany({
      where: {
        provider: { key: "manual" },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { provider: { select: { key: true } } },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      take: Math.min(80, Math.max(1, limit)),
    });
    return rows.map(mapMaterialCatalogToSupplierItem);
  },
  async getById(id) {
    const row = await prisma.materialCatalogItem.findFirst({
      where: { id, provider: { key: "manual" } },
      include: { provider: { select: { key: true } } },
    });
    return row ? mapMaterialCatalogToSupplierItem(row) : null;
  },
};

supplierRegistry.register(manualProvider);

export { manualProvider };
