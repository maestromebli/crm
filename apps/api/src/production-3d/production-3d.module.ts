import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "../auth/roles.guard";
import { Production3dController } from "./production-3d.controller";
import { Production3dService } from "./production-3d.service";

@Module({
  controllers: [Production3dController],
  providers: [Reflector, RolesGuard, Production3dService]
})
export class Production3dModule {}
