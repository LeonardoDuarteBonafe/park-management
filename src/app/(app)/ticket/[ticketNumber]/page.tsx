import { notFound } from "next/navigation";

import { TicketView } from "@/components/ticket/ticket-view";
import { getTicketByNumber } from "@/lib/services/tickets";

type PageProps = {
  params: Promise<{
    ticketNumber: string;
  }>;
};

export default async function TicketPage({ params }: PageProps) {
  const { ticketNumber } = await params;
  const ticket = await getTicketByNumber(ticketNumber);

  if (!ticket) {
    notFound();
  }

  return <TicketView ticket={ticket} />;
}
