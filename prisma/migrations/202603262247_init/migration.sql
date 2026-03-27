-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "public"."VehicleType" AS ENUM ('CAR', 'MOTORCYCLE', 'UTILITY');

-- CreateEnum
CREATE TYPE "public"."TicketStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'CASH');

-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('LOGIN', 'ENTRY_CREATED', 'PLATE_UPDATED', 'ENTRY_TIME_UPDATED', 'EXIT_RECORDED', 'PAYMENT_RECORDED', 'TICKET_CANCELLED', 'TICKET_MARKED_LOST', 'DISCOUNT_APPLIED', 'USER_CREATED', 'USER_UPDATED', 'PRICING_RULE_CREATED', 'PRICING_RULE_UPDATED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'OPERATOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PricingRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vehicleType" "public"."VehicleType" NOT NULL,
    "initialPriceCents" INTEGER NOT NULL,
    "graceMinutes" INTEGER NOT NULL,
    "additionalFractionMinutes" INTEGER NOT NULL,
    "additionalFractionPriceCents" INTEGER NOT NULL,
    "dailyMaxPriceCents" INTEGER NOT NULL,
    "lostTicketFeeCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ParkingTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "platePhotoPath" TEXT,
    "plateOcrSuggestion" TEXT,
    "vehicleType" "public"."VehicleType" NOT NULL DEFAULT 'CAR',
    "entryAt" TIMESTAMP(3) NOT NULL,
    "originalEntryAt" TIMESTAMP(3),
    "exitAt" TIMESTAMP(3),
    "notes" TEXT,
    "status" "public"."TicketStatus" NOT NULL DEFAULT 'OPEN',
    "manualEntryTimeChanged" BOOLEAN NOT NULL DEFAULT false,
    "lostTicket" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "chargeAmountCents" INTEGER,
    "discountAmountCents" INTEGER NOT NULL DEFAULT 0,
    "finalAmountCents" INTEGER,
    "pricingSnapshot" JSONB,
    "entryRegisteredById" TEXT NOT NULL,
    "exitRegisteredById" TEXT,
    "entryTimeAdjustedById" TEXT,
    "cancelledById" TEXT,
    "priceRuleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "amountChargedCents" INTEGER NOT NULL,
    "amountPaidCents" INTEGER NOT NULL,
    "changeAmountCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "registeredById" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "public"."AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "PricingRule_vehicleType_active_idx" ON "public"."PricingRule"("vehicleType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingTicket_ticketNumber_key" ON "public"."ParkingTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX "ParkingTicket_plate_idx" ON "public"."ParkingTicket"("plate");

-- CreateIndex
CREATE INDEX "ParkingTicket_status_entryAt_idx" ON "public"."ParkingTicket"("status", "entryAt");

-- CreateIndex
CREATE INDEX "ParkingTicket_ticketNumber_status_idx" ON "public"."ParkingTicket"("ticketNumber", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_ticketId_key" ON "public"."Payment"("ticketId");

-- CreateIndex
CREATE INDEX "Payment_paidAt_method_idx" ON "public"."Payment"("paidAt", "method");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "public"."AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "public"."AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."PricingRule" ADD CONSTRAINT "PricingRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PricingRule" ADD CONSTRAINT "PricingRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParkingTicket" ADD CONSTRAINT "ParkingTicket_entryRegisteredById_fkey" FOREIGN KEY ("entryRegisteredById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParkingTicket" ADD CONSTRAINT "ParkingTicket_exitRegisteredById_fkey" FOREIGN KEY ("exitRegisteredById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParkingTicket" ADD CONSTRAINT "ParkingTicket_entryTimeAdjustedById_fkey" FOREIGN KEY ("entryTimeAdjustedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParkingTicket" ADD CONSTRAINT "ParkingTicket_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParkingTicket" ADD CONSTRAINT "ParkingTicket_priceRuleId_fkey" FOREIGN KEY ("priceRuleId") REFERENCES "public"."PricingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."ParkingTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

