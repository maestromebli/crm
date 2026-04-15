import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ResolveScanDto, UpdatePartStageDto } from "./dto/resolve-scan.dto";
import { Production3dService } from "./production-3d.service";

@Controller("production-3d")
@UseGuards(RolesGuard)
export class Production3dController {
  constructor(private readonly production3dService: Production3dService) {}

  @Post("scans/resolve")
  @Roles(
    "cutting_operator",
    "edgebanding_operator",
    "drilling_operator",
    "assembler",
    "master",
    "technologist",
    "admin"
  )
  resolveScan(@Body() dto: ResolveScanDto) {
    return this.production3dService.resolveScan(dto);
  }

  @Get("parts/:partId/context")
  @Roles(
    "cutting_operator",
    "edgebanding_operator",
    "drilling_operator",
    "assembler",
    "master",
    "technologist",
    "admin"
  )
  getPartContext(@Param("partId") partId: string) {
    return this.production3dService.getPartContext(partId);
  }

  @Get("products/:productId/structure")
  @Roles("master", "technologist", "admin")
  getProductStructure(@Param("productId") productId: string) {
    return this.production3dService.getProductStructure(productId);
  }

  @Get("scan-events")
  @Roles("master", "technologist", "admin")
  getScanEvents(@Query("stage") stage?: string, @Query("partId") partId?: string) {
    return this.production3dService.getScanEvents({ stage, partId });
  }

  @Patch("parts/:partId/stage")
  @Roles("master", "technologist", "admin")
  updatePartStage(@Param("partId") partId: string, @Body() dto: UpdatePartStageDto) {
    return this.production3dService.updatePartStage(partId, dto);
  }
}
