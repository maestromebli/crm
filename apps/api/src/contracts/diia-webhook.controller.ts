import { Body, Controller, Post } from "@nestjs/common";
import { DiiaSignService } from "./diia/diia-sign.service";

@Controller("integrations/diia")
export class DiiaWebhookController {
  constructor(private readonly diiaSignService: DiiaSignService) {}

  @Post("webhook")
  handleWebhook(
    @Body() payload: { sessionId: string; status: string; data?: Record<string, unknown> }
  ) {
    return this.diiaSignService.handleWebhook(payload);
  }
}
