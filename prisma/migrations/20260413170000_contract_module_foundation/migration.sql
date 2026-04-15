-- Contract module foundation for ENVER supply contracts.

DO $$ BEGIN
  CREATE TYPE "ContractStatus" AS ENUM (
    'DRAFT','FILLED','UNDER_REVIEW','APPROVED','SENT_TO_CUSTOMER',
    'VIEWED_BY_CUSTOMER','CUSTOMER_SIGNING','CUSTOMER_SIGNED','FULLY_SIGNED',
    'REJECTED','NEEDS_REVISION','ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ContractDocumentType" AS ENUM (
    'CONTRACT_HTML','SPECIFICATION_HTML','CONTRACT_PDF','SPECIFICATION_PDF','FINAL_SIGNED_PDF'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ContractShareLinkStatus" AS ENUM ('ACTIVE','EXPIRED','REVOKED','USED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SignatureSessionStatus" AS ENUM ('CREATED','PENDING','IN_PROGRESS','SIGNED','DECLINED','EXPIRED','ERROR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Customer" (
  "id" TEXT PRIMARY KEY,
  "fullName" TEXT NOT NULL,
  "taxId" TEXT,
  "passportData" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Quotation" (
  "id" TEXT PRIMARY KEY,
  "externalProposalId" TEXT UNIQUE,
  "dealId" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'UAH',
  "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Quotation_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "QuotationItem" (
  "id" TEXT PRIMARY KEY,
  "quotationId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "productName" TEXT NOT NULL,
  "article" TEXT,
  "unit" TEXT NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "unitPrice" DECIMAL(18,2) NOT NULL,
  "lineTotal" DECIMAL(18,2) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Contract" (
  "id" TEXT PRIMARY KEY,
  "dealId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "quotationId" TEXT,
  "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
  "templateKey" TEXT NOT NULL DEFAULT 'supply-contract-v1',
  "contractNumber" TEXT NOT NULL,
  "contractDate" TIMESTAMP(3) NOT NULL,
  "customerType" TEXT,
  "objectAddress" TEXT,
  "deliveryAddress" TEXT,
  "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "advanceAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "remainingAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "productionLeadTimeDays" INTEGER,
  "installationLeadTime" TEXT,
  "paymentTerms" TEXT,
  "warrantyMonths" INTEGER,
  "managerComment" TEXT,
  "specialConditions" TEXT,
  "supplierSignerName" TEXT,
  "supplierSignerBasis" TEXT,
  "approvedAt" TIMESTAMP(3),
  "sentToCustomerAt" TIMESTAMP(3),
  "viewedByCustomerAt" TIMESTAMP(3),
  "customerSignedAt" TIMESTAMP(3),
  "fullySignedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Contract_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Contract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Contract_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ContractFieldValue" (
  "id" TEXT PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "fieldValue" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractFieldValue_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ContractSpecification" (
  "id" TEXT PRIMARY KEY,
  "contractId" TEXT NOT NULL UNIQUE,
  "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalFormattedText" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'UAH',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractSpecification_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ContractSpecificationItem" (
  "id" TEXT PRIMARY KEY,
  "specificationId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "productName" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "unitPrice" DECIMAL(18,2) NOT NULL,
  "lineTotal" DECIMAL(18,2) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractSpecificationItem_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "ContractSpecification"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ContractDocument" (
  "id" TEXT PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "type" "ContractDocumentType" NOT NULL,
  "fileName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "htmlBody" TEXT,
  "pdfUrl" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractDocument_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ContractShareLink" (
  "id" TEXT PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "status" "ContractShareLinkStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "maxViews" INTEGER,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "lastViewedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ContractShareLink_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ContractAuditLog" (
  "id" TEXT PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorRole" TEXT,
  "actorUserId" TEXT,
  "payloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractAuditLog_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SignatureSession" (
  "id" TEXT PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "shareLinkId" TEXT UNIQUE,
  "provider" "SignatureProvider" NOT NULL DEFAULT 'DIIA',
  "providerSessionId" TEXT NOT NULL UNIQUE,
  "status" "SignatureSessionStatus" NOT NULL DEFAULT 'CREATED',
  "signingUrl" TEXT,
  "signedAt" TIMESTAMP(3),
  "providerPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SignatureSession_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SignatureSession_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "ContractShareLink"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContractFieldValue_contractId_fieldKey_key" ON "ContractFieldValue"("contractId", "fieldKey");
