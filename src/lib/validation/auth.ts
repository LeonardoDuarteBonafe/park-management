import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(6, "Informe a senha."),
});

export type LoginInput = z.infer<typeof loginSchema>;
