import { PaymentMethod, TicketStatus } from "@prisma/client";
import {
  differenceInMinutes,
  eachWeekOfInterval,
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns";

import { prisma } from "@/lib/db";

type DashboardRange = {
  start: Date;
  end: Date;
};

export async function getDashboardSummary(range: DashboardRange) {
  const [entries, finalized, openTickets, payments, recentTickets, operatorGroups] =
    await Promise.all([
      prisma.parkingTicket.count({
        where: {
          entryAt: {
            gte: range.start,
            lte: range.end,
          },
        },
      }),
      prisma.parkingTicket.count({
        where: {
          status: TicketStatus.CLOSED,
          exitAt: {
            gte: range.start,
            lte: range.end,
          },
        },
      }),
      prisma.parkingTicket.count({
        where: { status: TicketStatus.OPEN },
      }),
      prisma.payment.findMany({
        where: {
          paidAt: {
            gte: range.start,
            lte: range.end,
          },
        },
        include: {
          ticket: true,
        },
      }),
      prisma.parkingTicket.findMany({
        where: {
          OR: [
            {
              entryAt: {
                gte: range.start,
                lte: range.end,
              },
            },
            {
              exitAt: {
                gte: range.start,
                lte: range.end,
              },
            },
          ],
        },
        include: {
          payment: true,
          entryRegisteredBy: {
            select: { id: true, name: true },
          },
          exitRegisteredBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      prisma.payment.groupBy({
        by: ["registeredById"],
        where: {
          paidAt: {
            gte: range.start,
            lte: range.end,
          },
        },
        _sum: {
          amountChargedCents: true,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

  const totalRevenueCents = payments.reduce((sum, payment) => sum + payment.amountChargedCents, 0);
  const averageTicketCents = payments.length ? Math.round(totalRevenueCents / payments.length) : 0;

  const closedDurations = await prisma.parkingTicket.findMany({
    where: {
      status: TicketStatus.CLOSED,
      exitAt: {
        gte: range.start,
        lte: range.end,
      },
    },
    select: {
      entryAt: true,
      exitAt: true,
    },
  });

  const averageStayMinutes = closedDurations.length
    ? Math.round(
        closedDurations.reduce((sum, ticket) => {
          if (!ticket.exitAt) {
            return sum;
          }

          return sum + differenceInMinutes(ticket.exitAt, ticket.entryAt);
        }, 0) / closedDurations.length,
      )
    : 0;

  const operatorIds = operatorGroups.map((group) => group.registeredById);
  const operatorUsers = operatorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: operatorIds } },
        select: { id: true, name: true },
      })
    : [];

  return {
    entries,
    finalized,
    openTickets,
    totalRevenueCents,
    averageTicketCents,
    averageStayMinutes,
    paymentsByMethod: buildPaymentsByMethod(payments),
    weeklySeries: await buildWeeklySeries(range),
    monthlySeries: await buildMonthlySeries(range),
    recentTickets,
    operatorPerformance: operatorGroups.map((group) => ({
      operatorId: group.registeredById,
      operatorName: operatorUsers.find((user) => user.id === group.registeredById)?.name ?? "Operador",
      totalCents: group._sum.amountChargedCents ?? 0,
      payments: group._count._all,
    })),
  };
}

export async function getHistoryReports(range: DashboardRange) {
  const [openTickets, closedTickets, payments, operatorMovements] = await Promise.all([
    prisma.parkingTicket.findMany({
      where: { status: TicketStatus.OPEN },
      include: {
        entryRegisteredBy: { select: { id: true, name: true } },
        payment: true,
      },
      orderBy: { entryAt: "desc" },
    }),
    prisma.parkingTicket.findMany({
      where: {
        status: TicketStatus.CLOSED,
        exitAt: {
          gte: range.start,
          lte: range.end,
        },
      },
      include: {
        entryRegisteredBy: { select: { id: true, name: true } },
        exitRegisteredBy: { select: { id: true, name: true } },
        payment: true,
      },
      orderBy: { exitAt: "desc" },
    }),
    prisma.payment.findMany({
      where: {
        paidAt: {
          gte: range.start,
          lte: range.end,
        },
      },
      include: {
        ticket: true,
        registeredBy: { select: { id: true, name: true } },
      },
      orderBy: { paidAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: range.start,
          lte: range.end,
        },
      },
      include: {
        actor: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return {
    openTickets,
    closedTickets,
    payments,
    operatorMovements,
  };
}

function buildPaymentsByMethod(
  payments: Array<{
    method: PaymentMethod;
    amountChargedCents: number;
  }>,
) {
  return Object.values(PaymentMethod).map((method) => {
    const methodPayments = payments.filter((payment) => payment.method === method);

    return {
      method,
      totalCents: methodPayments.reduce((sum, payment) => sum + payment.amountChargedCents, 0),
      count: methodPayments.length,
    };
  });
}

async function buildWeeklySeries(range: DashboardRange) {
  const weeks = eachWeekOfInterval(
    {
      start: range.start,
      end: range.end,
    },
    { weekStartsOn: 1 },
  );

  const entries = await Promise.all(
    weeks.map(async (weekStart) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const [count, revenue] = await Promise.all([
        prisma.parkingTicket.count({
          where: {
            entryAt: {
              gte: weekStart,
              lte: weekEnd,
            },
          },
        }),
        prisma.payment.aggregate({
          where: {
            paidAt: {
              gte: weekStart,
              lte: weekEnd,
            },
          },
          _sum: {
            amountChargedCents: true,
          },
        }),
      ]);

      return {
        label: format(weekStart, "dd/MM"),
        entradas: count,
        receita: revenue._sum.amountChargedCents ?? 0,
      };
    }),
  );

  return entries;
}

async function buildMonthlySeries(range: DashboardRange) {
  const startMonth = startOfMonth(range.start);
  const endMonth = endOfMonth(range.end);
  const months: Date[] = [];
  let cursor = new Date(startMonth);

  while (cursor <= endMonth) {
    months.push(new Date(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return Promise.all(
    months.map(async (monthStart) => {
      const monthEnd = endOfMonth(monthStart);
      const [count, revenue] = await Promise.all([
        prisma.parkingTicket.count({
          where: {
            entryAt: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
        }),
        prisma.payment.aggregate({
          where: {
            paidAt: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
          _sum: {
            amountChargedCents: true,
          },
        }),
      ]);

      return {
        label: format(monthStart, "MMM/yy"),
        entradas: count,
        receita: revenue._sum.amountChargedCents ?? 0,
      };
    }),
  );
}
