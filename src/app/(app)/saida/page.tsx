import { ExitWorkflow } from "@/components/exit/exit-workflow";
import { getCurrentUser } from "@/lib/data/current-user";

export default async function ExitPage() {
  const user = await getCurrentUser();

  return <ExitWorkflow isAdmin={user.role === "ADMIN"} />;
}
