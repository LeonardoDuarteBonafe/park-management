import { cache } from "react";

import { requireAuthenticatedUser } from "@/lib/auth/auth";

export const getCurrentUser = cache(async () => requireAuthenticatedUser());
