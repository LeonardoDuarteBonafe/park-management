"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/fields";
import { cacheTicket, queuePendingEntry } from "@/lib/offline/storage";
import type { PlateOcrResult } from "@/lib/ocr/types";
import { isValidBrazilianPlate } from "@/lib/plates/brazilian-plates";
import { formatDateInputValue, plateMask } from "@/lib/utils/format";

export function EntryWorkflow() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [pending, startTransition] = useTransition();
  const [ocrLoading, setOcrLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [plate, setPlate] = useState("");
  const [ocrSuggestion, setOcrSuggestion] = useState("");
  const [entryAt, setEntryAt] = useState(formatDateInputValue(new Date()));
  const [vehicleType, setVehicleType] = useState<"CAR" | "MOTORCYCLE" | "UTILITY">("CAR");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    void startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      toast.error("Não foi possível acessar a câmera. Você ainda pode registrar manualmente.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(dataUrl);
    setOcrLoading(true);

    if (!window.navigator.onLine) {
      setOcrSuggestion("");
      setOcrLoading(false);
      toast.error("Sem conexão para processar o OCR. Confirme a placa manualmente.");
      return;
    }

    try {
      const response = await fetch("/api/ocr/plate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataUrl,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        result?: PlateOcrResult;
      };

      if (!response.ok || !data.result?.plate_normalized) {
        setOcrSuggestion("");
        toast.error(
          data.error ?? "Não foi possível validar a placa automaticamente. Faça uma nova captura.",
        );
        return;
      }

      const suggestedPlate = data.result.plate_normalized;
      setOcrSuggestion(suggestedPlate);

      if (!plate || plate === ocrSuggestion) {
        setPlate(suggestedPlate);
      }
    } catch {
      setOcrSuggestion("");
      toast.error("OCR indisponível no momento. Confirme a placa manualmente.");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async () => {
    const normalizedPlate = plateMask(plate);

    if (!isValidBrazilianPlate(normalizedPlate)) {
      toast.error("Confirme uma placa brasileira válida antes de salvar.");
      return;
    }

    const payload = {
      plate: normalizedPlate,
      plateOcrSuggestion: ocrSuggestion || null,
      platePhotoDataUrl: capturedImage,
      vehicleType,
      entryAt,
      notes: notes || null,
    };

    if (!window.navigator.onLine) {
      await queuePendingEntry({
        localId: crypto.randomUUID(),
        plate: normalizedPlate,
        plateOcrSuggestion: ocrSuggestion || null,
        platePhotoDataUrl: capturedImage,
        vehicleType,
        entryAt,
        notes: notes || null,
        createdOfflineAt: new Date().toISOString(),
      });
      toast.success("Entrada salva localmente e será sincronizada quando a conexão voltar.");
      setPlate("");
      setNotes("");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        ticket?: {
          ticketNumber: string;
          plate: string;
          entryAt: string;
          status: "OPEN" | "CLOSED" | "CANCELLED";
        };
      };

      if (!response.ok || !data.ticket) {
        toast.error(data.error ?? "Não foi possível registrar a entrada.");
        return;
      }

      await cacheTicket({
        ticketNumber: data.ticket.ticketNumber,
        plate: data.ticket.plate,
        entryAt: data.ticket.entryAt,
        status: data.ticket.status,
      });

      toast.success("Entrada registrada com sucesso.");
      router.push(`/ticket/${data.ticket.ticketNumber}`);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              Registrar entrada
            </p>
            <h2 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-white">
              Capture a placa e confirme
            </h2>
          </div>
          <Button variant="secondary" onClick={() => void startCamera()}>
            Reabrir câmera
          </Button>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/8 bg-black">
          {capturedImage ? (
            <Image
              src={capturedImage}
              alt="Placa capturada"
              width={1280}
              height={720}
              unoptimized
              className="h-[320px] w-full object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-[320px] w-full object-cover"
            />
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => void handleCapture()} disabled={ocrLoading}>
            {ocrLoading ? "Detectando placa..." : "Capturar placa"}
          </Button>
          {capturedImage ? (
            <Button
              variant="secondary"
              onClick={() => {
                setCapturedImage(null);
                setOcrSuggestion("");
              }}
            >
              Nova foto
            </Button>
          ) : null}
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <FieldLabel
            label="Placa confirmada"
            hint="O OCR só sugere quando encontra uma placa brasileira válida."
          >
            <Input
              value={plate}
              onChange={(event) => setPlate(plateMask(event.target.value))}
              placeholder="ABC1234 ou ABC1D23"
              maxLength={7}
            />
          </FieldLabel>

          <FieldLabel label="Sugestão do OCR">
            <Input value={ocrSuggestion} readOnly placeholder="Aguardando captura" />
          </FieldLabel>

          <FieldLabel label="Tipo do veículo">
            <Select
              value={vehicleType}
              onChange={(event) => setVehicleType(event.target.value as typeof vehicleType)}
            >
              <option value="CAR">Carro</option>
              <option value="MOTORCYCLE">Moto</option>
              <option value="UTILITY">Utilitário</option>
            </Select>
          </FieldLabel>

          <FieldLabel
            label="Horário de entrada"
            hint="Por padrão é o momento atual. Ajustes manuais ficam auditados."
          >
            <Input
              type="datetime-local"
              value={entryAt}
              onChange={(event) => setEntryAt(event.target.value)}
            />
          </FieldLabel>

          <FieldLabel label="Observações">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ex.: vaga coberta, mensalista, porta malas aberto..."
            />
          </FieldLabel>

          <Button onClick={handleSubmit} fullWidth disabled={pending}>
            {pending ? "Salvando entrada..." : "Gerar ticket"}
          </Button>

          <div className="rounded-[24px] bg-[var(--color-panel-strong)] p-4 text-sm text-[var(--color-muted)]">
            <p className="font-semibold text-white">Resiliência operacional</p>
            <p className="mt-2">
              Se a conexão cair, a entrada fica na fila local e sincroniza assim que o aparelho voltar
              a ficar online.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
