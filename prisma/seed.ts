import "dotenv/config";
import { PrismaClient, UserRole, VehicleType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash("Admin123!", 10);
  const operatorPasswordHash = await bcrypt.hash("Operador123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@parkflow.local" },
    update: {
      name: "Administrador",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      active: true,
    },
    create: {
      name: "Administrador",
      email: "admin@parkflow.local",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      active: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "operador@parkflow.local" },
    update: {
      name: "Operador",
      passwordHash: operatorPasswordHash,
      role: UserRole.OPERATOR,
      active: true,
    },
    create: {
      name: "Operador",
      email: "operador@parkflow.local",
      passwordHash: operatorPasswordHash,
      role: UserRole.OPERATOR,
      active: true,
    },
  });

  const defaultRules = [
    {
      vehicleType: VehicleType.CAR,
      name: "Carro - padrao",
      initialPriceCents: 1200,
      graceMinutes: 15,
      additionalFractionMinutes: 60,
      additionalFractionPriceCents: 800,
      dailyMaxPriceCents: 4500,
      lostTicketFeeCents: 6000,
    },
    {
      vehicleType: VehicleType.MOTORCYCLE,
      name: "Moto - padrao",
      initialPriceCents: 900,
      graceMinutes: 15,
      additionalFractionMinutes: 60,
      additionalFractionPriceCents: 600,
      dailyMaxPriceCents: 3200,
      lostTicketFeeCents: 4500,
    },
    {
      vehicleType: VehicleType.UTILITY,
      name: "Utilitario - padrao",
      initialPriceCents: 1800,
      graceMinutes: 15,
      additionalFractionMinutes: 60,
      additionalFractionPriceCents: 1200,
      dailyMaxPriceCents: 6500,
      lostTicketFeeCents: 9000,
    },
  ];

  for (const rule of defaultRules) {
    await prisma.pricingRule.upsert({
      where: {
        id: `${rule.vehicleType}-default`,
      },
      update: {
        ...rule,
        active: true,
        updatedById: admin.id,
      },
      create: {
        id: `${rule.vehicleType}-default`,
        ...rule,
        active: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
