import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const localPython =
  process.platform === "win32"
    ? path.join(cwd, ".venv", "Scripts", "python.exe")
    : path.join(cwd, ".venv", "bin", "python");

const pythonCommand =
  process.env.PLATE_OCR_PYTHON_BIN ||
  (existsSync(localPython) ? localPython : "python");

const child = spawn(
  pythonCommand,
  ["-m", "unittest", "discover", "-s", "python/tests", "-t", "python", "-v"],
  {
    cwd,
    env: process.env,
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
