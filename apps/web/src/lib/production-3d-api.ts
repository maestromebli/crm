export const PRODUCTION_3D_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export type ProductionStage = "CUTTING" | "EDGEBANDING" | "DRILLING" | "ASSEMBLY";

export interface PartPayload {
  id: string;
  orderId: string;
  productId: string;
  moduleId: string;
  internalId: string;
  barcode: string;
  articleCode: string;
  partName: string;
  dimensions: { width: number; height: number; thickness: number };
  material: string;
  edgingInfo: string;
  drillingInfo: string;
  status: string;
  currentStage: ProductionStage;
  objectId3d: string;
  transform: { position: [number, number, number]; rotation: [number, number, number] };
}

export interface ResolveScanPayload {
  resultStatus: "OK" | "BARCODE_NOT_FOUND" | "MODEL_MISSING" | "MODULE_LINK_MISSING" | "ERROR";
  order: { id: string; number: string; customer: string; projectName: string } | null;
  product: { id: string; name: string; modelId: string; modelUrl: string } | null;
  module: { id: string; productId: string; name: string } | null;
  part: PartPayload | null;
  neighbors: PartPayload[];
  tree: {
    orderId: string;
    products: Array<{
      id: string;
      name: string;
      modules: Array<{ id: string; name: string; parts: Array<{ id: string; partName: string; barcode: string }> }>;
    }>;
  } | null;
}

interface ResolveRequestInput {
  barcode: string;
  station: string;
  operatorName: string;
  stage: ProductionStage;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PRODUCTION_3D_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-role": "master",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const production3dApi = {
  resolveScan: (payload: ResolveRequestInput) =>
    request<ResolveScanPayload>("/production-3d/scans/resolve", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getScanEvents: () =>
    request<
      Array<{
        id: string;
        barcode: string;
        partId: string | null;
        stage: ProductionStage;
        station: string;
        operatorName: string;
        resultStatus: string;
        scannedAt: string;
      }>
    >("/production-3d/scan-events")
};
