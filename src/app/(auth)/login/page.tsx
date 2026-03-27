import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,184,61,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(28,145,255,0.1),transparent_35%)]" />
      <div className="relative z-10 grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[36px] border border-white/8 bg-[var(--color-panel)] p-8 shadow-[0_30px_70px_rgba(5,10,19,0.4)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
            MVP funcional
          </p>
          <h1 className="mt-4 max-w-xl text-6xl font-semibold leading-[0.92] tracking-[-0.06em] text-white">
            Operação de estacionamento pensada para dedo, câmera e fila.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[var(--color-muted)]">
            Cadastro de entrada com OCR, ticket com QR Code, leitura na saída, cálculo
            automático, pagamento auditável e dashboard gerencial no mesmo fluxo.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["Entrada", "Foto da placa, OCR sugerido e edição manual obrigatória."],
              ["Saída", "Leitura por câmera, cálculo transparente e pagamento seguro."],
              ["Gestão", "Dashboard, preços, usuários e auditoria de ponta a ponta."],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-[28px] border border-white/8 bg-[var(--color-panel-strong)] p-4"
              >
                <h2 className="text-xl font-semibold text-white">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-center justify-center">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
