import { TicketSearch } from "@/components/ticket/ticket-search";
import { getCurrentUser } from "@/lib/data/current-user";

export default async function TicketSearchPage() {
  const user = await getCurrentUser();

  return <TicketSearch isAdmin={user.role === "ADMIN"} />;
}
