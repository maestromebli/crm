import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ContractsService } from "./contracts.service";
import { CreateContractFromQuotationDto } from "./dto/create-from-quotation.dto";
import { ShareContractDto } from "./dto/share-contract.dto";
import { UpdateContractDto } from "./dto/update-contract.dto";

@Controller()
@UseGuards(RolesGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post("contracts/create-from-quotation")
  @Roles("manager", "admin")
  createFromQuotation(@Body() dto: CreateContractFromQuotationDto, @Req() req: Request) {
    return this.contractsService.createFromQuotation(dto, this.getActor(req));
  }

  @Get("contracts/:id")
  @Roles("manager", "admin")
  getById(@Param("id") id: string) {
    return this.contractsService.getById(id);
  }

  @Patch("contracts/:id")
  @Roles("manager", "admin")
  update(@Param("id") id: string, @Body() dto: UpdateContractDto, @Req() req: Request) {
    return this.contractsService.updateContract(id, dto, this.getActor(req));
  }

  @Post("contracts/:id/generate-documents")
  @Roles("manager", "admin")
  generateDocuments(@Param("id") id: string, @Req() req: Request) {
    return this.contractsService.generateDocuments(id, this.getActor(req));
  }

  @Post("contracts/:id/send-for-review")
  @Roles("manager", "admin")
  sendForReview(@Param("id") id: string, @Req() req: Request) {
    return this.contractsService.sendForReview(id, this.getActor(req));
  }

  @Post("contracts/:id/approve")
  @Roles("manager", "admin")
  approve(@Param("id") id: string, @Req() req: Request) {
    return this.contractsService.approve(id, this.getActor(req));
  }

  @Post("contracts/:id/share")
  @Roles("manager", "admin")
  share(@Param("id") id: string, @Body() dto: ShareContractDto, @Req() req: Request) {
    return this.contractsService.shareContract(id, dto, this.getActor(req));
  }

  @Post("contracts/:id/needs-revision")
  @Roles("manager", "admin")
  needsRevision(@Param("id") id: string, @Req() req: Request) {
    return this.contractsService.createNeedsRevision(id, this.getActor(req));
  }

  private getActor(req: Request) {
    const roleHeader = req.headers["x-role"];
    const userHeader = req.headers["x-user-id"];
    return {
      role: typeof roleHeader === "string" ? roleHeader : "manager",
      userId: typeof userHeader === "string" ? userHeader : undefined
    };
  }
}
