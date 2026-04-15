import { INestApplication, Injectable, OnModuleInit } from "@nestjs/common";

@Injectable()
export class PrismaService implements OnModuleInit {
  [key: string]: any;
  private readonly client: any;

  constructor() {
    const { PrismaClient } = require("@prisma/client");
    this.client = new PrismaClient();
    Object.assign(this, this.client);
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    this.client.$on("beforeExit", async () => {
      await app.close();
    });
  }
}
