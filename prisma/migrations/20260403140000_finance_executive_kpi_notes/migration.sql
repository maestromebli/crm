-- CreateTable
CREATE TABLE "FinanceExecutiveKpiNote" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceExecutiveKpiNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceExecutiveKpiNote_metricId_key" ON "FinanceExecutiveKpiNote"("metricId");

-- AddForeignKey
ALTER TABLE "FinanceExecutiveKpiNote" ADD CONSTRAINT "FinanceExecutiveKpiNote_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
