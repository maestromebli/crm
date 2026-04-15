import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { ContractsModule } from "./contracts/contracts.module";
import { Production3dModule } from "./production-3d/production-3d.module";

@Module({
  imports: [PrismaModule, ContractsModule, Production3dModule],
  controllers: [],
  providers: []
})
export class AppModule {}

