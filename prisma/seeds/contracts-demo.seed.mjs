import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function main() {
  const deal = await prisma.deal.findFirst({
    include: {
      lead: {
        include: {
          proposals: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!deal) {
    console.warn("Немає Deal для demo seed");
    return;
  }

  const proposal = deal.lead?.proposals?.[0];
  if (!proposal) {
    console.warn("Немає LeadProposal для demo seed");
    return;
  }

  const existing = await prisma.dealContract.findUnique({ where: { dealId: deal.id } });
  if (existing) {
    console.log("Deal contract already exists:", existing.id);
    return;
  }

  const contract = await prisma.dealContract.create({
    data: {
      dealId: deal.id,
      status: "EDITED",
      templateKey: "contract_supply_goods_zrazok_html",
      content: {
        documentType: "CONTRACT",
        format: "HTML",
        templateKey: "contract_supply_goods_zrazok_html",
        recipientType: "CLIENT_PERSON",
        variables: {
          contractNumber: `EN-DEMO-${Date.now()}`,
          contractDate: new Date().toISOString(),
          customerFullName: deal.client?.name ?? "Клієнт",
          objectAddress: "м. Київ, вул. Демо, 1",
        },
        contentHtml:
          "<h1>Договір поставки товару</h1><p>Номер: {{contractNumber}}</p><p>Клієнт: {{customerFullName}}</p>",
        contentJson: {
          fields: {
            contractNumber: `EN-DEMO-${Date.now()}`,
            contractDate: new Date().toISOString(),
            customerFullName: deal.client?.name ?? "Клієнт",
            totalAmount: 120000,
            advanceAmount: 84000,
            remainingAmount: 36000,
          },
          specification: {
            items: [
              {
                lineNumber: 1,
                productName: "Кухня МДФ",
                unit: "компл.",
                quantity: 1,
                unitPrice: 120000,
                lineTotal: 120000,
                notes: "Демо позиція",
              },
            ],
            subtotal: 120000,
            total: 120000,
            formattedTotalText: "120000.00 гривень",
            currency: "UAH",
          },
          quotationId: proposal.id,
        },
      },
    },
  });

  const token = randomBytes(24).toString("base64url");
  const tokenHash = hashToken(token);

  if (prisma.contractShareLink) {
    await prisma.contractShareLink.create({
      data: {
        contractId: contract.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        maxViews: 10,
      },
    });
  }

  await prisma.activityLog.create({
    data: {
      entityType: "DEAL",
      entityId: deal.id,
      type: "CONTRACT_CREATED",
      actorUserId: null,
      source: "SYSTEM",
      data: { action: "seed_demo_contract", contractId: contract.id, shareToken: token },
    },
  });

  console.log("Demo contract created:", contract.id);
  console.log("Portal token:", token);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
