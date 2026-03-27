import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import { plateOcrResultSchema, type PlateOcrResult } from "@/lib/ocr/types";

type RecognizePlateInput = {
  dataUrl: string;
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  debug?: boolean;
};

export async function recognizeBrazilianPlate(
  input: RecognizePlateInput,
): Promise<PlateOcrResult> {
  const requestId = randomUUID();
  const scriptPath = path.join(process.cwd(), "python", "plate_ocr", "cli.py");
  const debugEnabled = input.debug ?? process.env.PLATE_OCR_DEBUG === "1";
  const debugDirectory = debugEnabled
    ? path.join(process.cwd(), "public", "uploads", "plate-ocr-debug", requestId)
    : null;

  if (debugDirectory) {
    await mkdir(debugDirectory, { recursive: true });
  }

  const payload = JSON.stringify({
    image_data_url: input.dataUrl,
    roi: input.roi ?? null,
    request_id: requestId,
    debug_dir: debugDirectory,
    debug_url_prefix: debugEnabled ? `/uploads/plate-ocr-debug/${requestId}` : null,
  });

  const bundledPythonPath =
    process.platform === "win32"
      ? path.join(process.cwd(), ".venv", "Scripts", "python.exe")
      : path.join(process.cwd(), ".venv", "bin", "python");
  const pythonCommand =
    process.env.PLATE_OCR_PYTHON_BIN ||
    (existsSync(bundledPythonPath) ? bundledPythonPath : "python");

  return new Promise<PlateOcrResult>((resolve, reject) => {
    const child = spawn(pythonCommand, [scriptPath, "--stdin-json"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Tempo limite excedido ao executar o OCR de placas."));
    }, 90_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() || `O processo Python do OCR encerrou com código ${code ?? "desconhecido"}.`,
          ),
        );
        return;
      }

      try {
        const parsed = plateOcrResultSchema.parse(JSON.parse(stdout));
        console.info("[plate-ocr]", {
          requestId,
          plate: parsed.plate_normalized,
          plateFormat: parsed.plate_format,
          confidence: parsed.confidence,
          corrections: parsed.corrections_applied,
          candidates: parsed.candidates,
          debugImages: parsed.debug_images_paths,
        });
        resolve(parsed);
      } catch (error) {
        reject(
          new Error(
            error instanceof Error
              ? `Resposta inválida do OCR: ${error.message}`
              : "Resposta inválida do OCR.",
          ),
        );
      }
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
}
