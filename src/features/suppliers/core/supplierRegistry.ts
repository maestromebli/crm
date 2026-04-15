import type {
  SupplierItem,
  SupplierKey,
  SupplierProvider,
  SupplierSearchQuery,
} from "./supplierTypes";

class SupplierRegistry {
  private readonly providers = new Map<SupplierKey, SupplierProvider>();

  register(provider: SupplierProvider): void {
    this.providers.set(provider.key, provider);
  }

  listProviders(): SupplierProvider[] {
    return [...this.providers.values()];
  }

  getProvider(key: SupplierKey): SupplierProvider | null {
    return this.providers.get(key) ?? null;
  }

  async searchAll(query: SupplierSearchQuery): Promise<SupplierItem[]> {
    const wanted = query.suppliers?.length
      ? query.suppliers
      : (this.providers.keys() as Iterable<SupplierKey>);
    const tasks = [...wanted]
      .map((key) => this.providers.get(key))
      .filter((p): p is SupplierProvider => Boolean(p))
      .map((p) => p.search(query));
    const batches = await Promise.all(tasks);
    return batches.flat();
  }
}

export const supplierRegistry = new SupplierRegistry();
