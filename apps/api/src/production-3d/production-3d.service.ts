import { Injectable, NotFoundException } from "@nestjs/common";
import { ResolveScanDto, UpdatePartStageDto } from "./dto/resolve-scan.dto";
import {
  ProductionModule,
  ProductionOrder,
  ProductionPart,
  ProductionProduct,
  ProductionStage,
  ScanEvent,
  ScanResultStatus
} from "./production-3d.types";

interface ResolvedScanPayload {
  resultStatus: ScanResultStatus;
  order: ProductionOrder | null;
  product: ProductionProduct | null;
  module: ProductionModule | null;
  part: ProductionPart | null;
  neighbors: ProductionPart[];
  tree: {
    orderId: string;
    products: Array<{
      id: string;
      name: string;
      modules: Array<{ id: string; name: string; parts: Array<{ id: string; partName: string; barcode: string }> }>;
    }>;
  } | null;
}

@Injectable()
export class Production3dService {
  private readonly orders: ProductionOrder[] = [
    { id: "ord_1001", number: "ORD-1001", customer: "ТОВ Меблі Плюс", projectName: "Кухня + шафа-купе" }
  ];

  private readonly products: ProductionProduct[] = [
    {
      id: "prod_kitchen_1",
      orderId: "ord_1001",
      name: "Кухня пряма 3.2м",
      modelId: "model_kitchen_1",
      modelUrl: "/robot-assistant/enver_crm_robot_assistant.glb"
    }
  ];

  private readonly modules: ProductionModule[] = [
    { id: "mod_base_1", productId: "prod_kitchen_1", name: "Тумба під мийку" },
    { id: "mod_base_2", productId: "prod_kitchen_1", name: "Тумба з шухлядами" }
  ];

  private readonly parts: ProductionPart[] = [
    {
      id: "part_1",
      orderId: "ord_1001",
      productId: "prod_kitchen_1",
      moduleId: "mod_base_1",
      internalId: "INT-001",
      barcode: "482000000001",
      articleCode: "DSP-18-900x560",
      partName: "Боковина ліва",
      dimensions: { width: 900, height: 560, thickness: 18 },
      material: "ЛДСП Egger W980",
      edgingInfo: "Кромка 2мм: 1 сторона",
      drillingInfo: "Присадка конфірмат 7x50",
      status: "IN_PROGRESS",
      currentStage: "CUTTING",
      objectId3d: "obj_part_1",
      transform: { position: [-1.2, 0, 0], rotation: [0, 0, 0] }
    },
    {
      id: "part_2",
      orderId: "ord_1001",
      productId: "prod_kitchen_1",
      moduleId: "mod_base_1",
      internalId: "INT-002",
      barcode: "482000000002",
      articleCode: "DSP-18-900x560",
      partName: "Боковина права",
      dimensions: { width: 900, height: 560, thickness: 18 },
      material: "ЛДСП Egger W980",
      edgingInfo: "Кромка 2мм: 1 сторона",
      drillingInfo: "Присадка конфірмат 7x50",
      status: "IN_PROGRESS",
      currentStage: "EDGEBANDING",
      objectId3d: "obj_part_2",
      transform: { position: [1.2, 0, 0], rotation: [0, 0, 0] }
    },
    {
      id: "part_3",
      orderId: "ord_1001",
      productId: "prod_kitchen_1",
      moduleId: "mod_base_2",
      internalId: "INT-003",
      barcode: "482000000003",
      articleCode: "FAS-18-596x140",
      partName: "Фасад шухляди",
      dimensions: { width: 596, height: 140, thickness: 18 },
      material: "МДФ фарбований",
      edgingInfo: "Фрезерування + фарбування",
      drillingInfo: "Направляючі прихованого монтажу",
      status: "WAITING",
      currentStage: "DRILLING",
      objectId3d: "obj_part_3",
      transform: { position: [0, -0.8, 1], rotation: [0, 0, 0] }
    }
  ];

  private readonly scanEvents: ScanEvent[] = [];

  private readonly allowedStages: ProductionStage[] = ["CUTTING", "EDGEBANDING", "DRILLING", "ASSEMBLY"];

  resolveScan(input: ResolveScanDto): ResolvedScanPayload {
    const stage = this.normalizeStage(input.stage);
    const barcode = input.barcode.trim();
    const part = this.parts.find((item) => item.barcode === barcode) ?? null;

    if (!part) {
      this.pushEvent({
        barcode,
        stage,
        station: input.station,
        operatorName: input.operatorName,
        resultStatus: "BARCODE_NOT_FOUND",
        part: null
      });
      return {
        resultStatus: "BARCODE_NOT_FOUND",
        order: null,
        product: null,
        module: null,
        part: null,
        neighbors: [],
        tree: null
      };
    }

    const order = this.orders.find((item) => item.id === part.orderId) ?? null;
    const product = this.products.find((item) => item.id === part.productId) ?? null;
    const module = this.modules.find((item) => item.id === part.moduleId) ?? null;

    const resultStatus: ScanResultStatus = !product ? "MODEL_MISSING" : !module ? "MODULE_LINK_MISSING" : "OK";

    this.pushEvent({
      barcode,
      stage,
      station: input.station,
      operatorName: input.operatorName,
      resultStatus,
      part
    });

    return {
      resultStatus,
      order,
      product,
      module,
      part,
      neighbors: this.parts.filter((item) => item.moduleId === part.moduleId && item.id !== part.id),
      tree: order ? this.buildTree(order.id) : null
    };
  }

  getPartContext(partId: string) {
    const part = this.parts.find((item) => item.id === partId);
    if (!part) {
      throw new NotFoundException("Деталь не знайдена");
    }

    const order = this.orders.find((item) => item.id === part.orderId) ?? null;
    const product = this.products.find((item) => item.id === part.productId) ?? null;
    const module = this.modules.find((item) => item.id === part.moduleId) ?? null;
    const siblings = this.parts.filter((item) => item.moduleId === part.moduleId && item.id !== part.id);

    return {
      part,
      order,
      product,
      module,
      siblings,
      tree: this.buildTree(part.orderId)
    };
  }

  getProductStructure(productId: string) {
    const product = this.products.find((item) => item.id === productId);
    if (!product) {
      throw new NotFoundException("Виріб не знайдений");
    }

    const order = this.orders.find((item) => item.id === product.orderId) ?? null;
    const modules = this.modules.filter((item) => item.productId === productId);

    return {
      order,
      product,
      modules: modules.map((moduleItem) => ({
        ...moduleItem,
        parts: this.parts.filter((part) => part.moduleId === moduleItem.id)
      }))
    };
  }

  getScanEvents(filters?: { stage?: string; partId?: string }) {
    return this.scanEvents
      .filter((event) => (filters?.stage ? event.stage === filters.stage : true))
      .filter((event) => (filters?.partId ? event.partId === filters.partId : true))
      .sort((a, b) => (a.scannedAt < b.scannedAt ? 1 : -1));
  }

  updatePartStage(partId: string, dto: UpdatePartStageDto) {
    const part = this.parts.find((item) => item.id === partId);
    if (!part) {
      throw new NotFoundException("Деталь не знайдена");
    }
    part.currentStage = this.normalizeStage(dto.stage);
    if (dto.status) {
      part.status = dto.status;
    }
    return part;
  }

  private normalizeStage(stage: string): ProductionStage {
    const candidate = (stage ?? "").toUpperCase() as ProductionStage;
    if (!this.allowedStages.includes(candidate)) {
      return "CUTTING";
    }
    return candidate;
  }

  private buildTree(orderId: string) {
    const products = this.products.filter((item) => item.orderId === orderId);
    return {
      orderId,
      products: products.map((product) => {
        const productModules = this.modules.filter((module) => module.productId === product.id);
        return {
          id: product.id,
          name: product.name,
          modules: productModules.map((module) => ({
            id: module.id,
            name: module.name,
            parts: this.parts
              .filter((part) => part.moduleId === module.id)
              .map((part) => ({ id: part.id, partName: part.partName, barcode: part.barcode }))
          }))
        };
      })
    };
  }

  private pushEvent(input: {
    barcode: string;
    stage: ProductionStage;
    station: string;
    operatorName: string;
    resultStatus: ScanResultStatus;
    part: ProductionPart | null;
  }) {
    this.scanEvents.push({
      id: `scan_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      barcode: input.barcode,
      partId: input.part?.id ?? null,
      orderId: input.part?.orderId ?? null,
      productId: input.part?.productId ?? null,
      moduleId: input.part?.moduleId ?? null,
      stage: input.stage,
      station: input.station,
      operatorName: input.operatorName,
      resultStatus: input.resultStatus,
      scannedAt: new Date().toISOString()
    });
  }
}
