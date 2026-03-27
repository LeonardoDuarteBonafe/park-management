from __future__ import annotations

import argparse
import json
import sys

from plate_ocr.pipeline import run_from_json


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Leitor de placas brasileiras com PaddleOCR.")
    parser.add_argument(
        "--stdin-json",
        action="store_true",
        help="Lê um payload JSON completo via stdin.",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if not args.stdin_json:
        parser.error("Use --stdin-json para enviar a imagem via stdin.")

    payload = sys.stdin.read()

    try:
        result = run_from_json(payload)
    except Exception as error:  # noqa: BLE001 - CLI precisa devolver falha controlada
        print(str(error), file=sys.stderr)
        return 1

    sys.stdout.write(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
