-- CreateEnum
CREATE TYPE "ContactCategory" AS ENUM (
  'DESIGNER',
  'CONSTRUCTION_COMPANY',
  'MANAGER',
  'DESIGN_STUDIO',
  'END_CUSTOMER',
  'ARCHITECT',
  'SUPPLIER',
  'OTHER'
);

-- AlterTable
ALTER TABLE "Contact"
ADD COLUMN "category" "ContactCategory" NOT NULL DEFAULT 'OTHER';
