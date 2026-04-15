import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const deal = await prisma.deal.findFirst();
  if (!deal) {
    console.warn("Seed contracts: пропущено, немає Deal у базі.");
    return;
  }

  const quotation = await prisma.quotation.create({
    data: {
      dealId: deal.id,
      currency: "UAH",
      totalAmount: 185000,
      discountAmount: 5000,
      items: {
        create: [
          {
            lineNumber: 1,
            productName: "Кухня МДФ фарбований",
            article: "KITCH-001",
            unit: "компл.",
            quantity: 1,
            unitPrice: 140000,
            lineTotal: 140000
          },
          {
            lineNumber: 2,
            productName: "Шафа-купе 2.8м",
            article: "WARD-009",
            unit: "шт",
            quantity: 1,
            unitPrice: 45000,
            lineTotal: 45000
          }
        ]
      }
    }
  });

  const customer = await prisma.customer.create({
    data: {
      fullName: "Петренко Олена Сергіївна",
      taxId: "3216549870",
      phone: "+380501234567",
      email: "olena.petrenko@example.com",
      address: "м. Київ, вул. Велика Васильківська, 100"
    }
  });

  const contract = await prisma.contract.create({
    data: {
      dealId: deal.id,
      customerId: customer.id,
      quotationId: quotation.id,
      status: "FILLED",
      contractNumber: `EN-SEED-${Date.now()}`,
      contractDate: new Date(),
      customerType: "PERSON",
      objectAddress: customer.address,
      deliveryAddress: customer.address,
      totalAmount: quotation.totalAmount,
      advanceAmount: 92500,
      remainingAmount: 92500,
      productionLeadTimeDays: 30,
      installationLeadTime: "2-4 дні",
      paymentTerms: "50% аванс / 50% перед монтажем",
      warrantyMonths: 24,
      supplierSignerName: "Мамедов Енвер Микаилович",
      supplierSignerBasis: "ФОП"
    }
  });

  const specification = await prisma.contractSpecification.create({
    data: {
      contractId: contract.id,
      subtotal: 185000,
      total: 185000,
      totalFormattedText: "185000.00 гривень",
      currency: "UAH"
    }
  });

  await prisma.contractSpecificationItem.createMany({
    data: [
      {
        specificationId: specification.id,
        lineNumber: 1,
        productName: "Кухня МДФ фарбований",
        unit: "компл.",
        quantity: 1,
        unitPrice: 140000,
        lineTotal: 140000
      },
      {
        specificationId: specification.id,
        lineNumber: 2,
        productName: "Шафа-купе 2.8м",
        unit: "шт",
        quantity: 1,
        unitPrice: 45000,
        lineTotal: 45000
      }
    ]
  });

  console.log("Seed contracts: demo contract created", contract.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
