import { Controller, Get, Param, Post } from "@nestjs/common";
import { ContractsService } from "./contracts.service";

@Controller("portal/contracts")
export class PortalController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get(":token")
  getContractByToken(@Param("token") token: string) {
    return this.contractsService.getPortalContract(token);
  }

  @Post(":token/viewed")
  markViewed(@Param("token") token: string) {
    return this.contractsService.markPortalViewed(token);
  }

  @Post(":token/sign")
  sign(@Param("token") token: string) {
    return this.contractsService.signViaPortal(token);
  }
}
