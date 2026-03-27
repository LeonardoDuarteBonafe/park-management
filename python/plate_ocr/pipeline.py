from __future__ import annotations

import base64
import binascii
import contextlib
import json
import os
import re
import sys
import tempfile
from dataclasses import asdict, dataclass, field
from pathlib import Path
from statistics import mean
from typing import Any, Protocol

import cv2
import numpy as np

os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

try:
    from paddleocr import PaddleOCR
except ImportError:  # pragma: no cover - exercised only when deps are missing at runtime
    PaddleOCR = None

OLD_BR_REGEX = re.compile(r"^[A-Z]{3}[0-9]{4}$")
MERCOSUL_REGEX = re.compile(r"^[A-Z]{3}[0-9][A-Z][0-9]{2}$")
NON_ALNUM_REGEX = re.compile(r"[^A-Za-z0-9]")

LETTER_TO_DIGIT = {"O": "0", "I": "1", "Z": "2", "S": "5", "B": "8"}
DIGIT_TO_LETTER = {value: key for key, value in LETTER_TO_DIGIT.items()}


class OCREngine(Protocol):
    def recognize(self, image_path: Path) -> list["OCRTextObservation"]:
        ...


@dataclass(slots=True)
class OCRTextObservation:
    text: str
    confidence: float


@dataclass(slots=True)
class PlateRegion:
    x: int
    y: int
    width: int
    height: int
    score: float
    source: str


@dataclass(slots=True)
class RankedCandidate:
    source: str
    raw_text: str
    sanitized_text: str
    normalized_text: str | None
    plate_format: str
    confidence: float
    corrections_applied: list[str] = field(default_factory=list)
    corrections_count: int = 0
    valid: bool = False
    occurrences: int = 1


class PaddlePlateOCREngine:
    def __init__(self) -> None:
        if PaddleOCR is None:
            raise RuntimeError(
                "PaddleOCR não está instalado. Rode `python -m pip install -r python/requirements.txt`."
            )

        with contextlib.redirect_stdout(sys.stderr), contextlib.redirect_stderr(sys.stderr):
            self._ocr = PaddleOCR(
                lang="en",
                device=os.getenv("PADDLEOCR_DEVICE", "cpu"),
                enable_hpi=False,
                enable_mkldnn=False,
                text_rec_score_thresh=0.0,
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )

    def recognize(self, image_path: Path) -> list[OCRTextObservation]:
        with contextlib.redirect_stdout(sys.stderr), contextlib.redirect_stderr(sys.stderr):
            predictions = self._ocr.predict(input=str(image_path))

        observations: list[OCRTextObservation] = []

        for prediction in predictions:
            payload = _coerce_prediction_payload(prediction)
            texts = payload.get("rec_texts") or []
            scores = payload.get("rec_scores") or []

            for index, text in enumerate(texts):
                confidence = float(scores[index]) if index < len(scores) else 0.0
                observations.append(
                    OCRTextObservation(text=str(text), confidence=max(0.0, min(confidence, 1.0)))
                )

        return observations


class BrazilianPlatePipeline:
    def __init__(self, ocr_engine: OCREngine | None = None) -> None:
        self.ocr_engine = ocr_engine or PaddlePlateOCREngine()

    def process(
        self,
        image: np.ndarray,
        *,
        roi: dict[str, float | int] | None = None,
        request_id: str | None = None,
        debug_dir: str | None = None,
        debug_url_prefix: str | None = None,
    ) -> dict[str, Any]:
        if image.size == 0:
            raise ValueError("Imagem vazia recebida pelo OCR.")

        request_token = request_id or "plate-ocr"
        debug_directory = Path(debug_dir) if debug_dir else None
        debug_urls: list[str] = []

        if debug_directory is not None:
            debug_directory.mkdir(parents=True, exist_ok=True)

        debug_urls.extend(
            filter(
                None,
                [
                    self._save_debug_image(
                        debug_directory, debug_url_prefix, "original", image
                    ),
                ],
            )
        )

        regions, locator_debug = locate_plate_regions(image, roi=roi)

        debug_urls.extend(
            filter(
                None,
                [
                    self._save_debug_image(
                        debug_directory, debug_url_prefix, "region-proposals", locator_debug
                    )
                ],
            )
        )

        observations: list[RankedCandidate] = []

        with tempfile.TemporaryDirectory(prefix=f"{request_token}-") as temp_dir:
            temp_path = Path(temp_dir)

            for region_index, region in enumerate(regions):
                crop = crop_region(image, region)
                if crop.size == 0:
                    continue

                region_name = f"roi-{region_index + 1}-{region.source}"
                debug_urls.extend(
                    filter(
                        None,
                        [
                            self._save_debug_image(
                                debug_directory, debug_url_prefix, region_name, crop
                            )
                        ],
                    )
                )

                variants = generate_plate_variants(crop)

                for variant_name, variant in variants.items():
                    variant_file = temp_path / f"{region_name}-{variant_name}.png"
                    cv2.imwrite(str(variant_file), variant)
                    debug_urls.extend(
                        filter(
                            None,
                            [
                                self._save_debug_image(
                                    debug_directory,
                                    debug_url_prefix,
                                    f"{region_name}-{variant_name}",
                                    variant,
                                )
                            ],
                        )
                    )

                    texts = self.ocr_engine.recognize(variant_file)
                    raw_candidates = build_raw_candidates(texts, f"{region_name}:{variant_name}")
                    observations.extend(score_candidate(raw, confidence, source) for raw, confidence, source in raw_candidates)

        ranked = merge_and_rank(observations)
        best_valid = next((candidate for candidate in ranked if candidate.valid), None)
        best_any = ranked[0] if ranked else None

        final_candidate = best_valid or best_any
        result = {
            "plate_raw": final_candidate.raw_text if final_candidate else None,
            "plate_normalized": best_valid.normalized_text if best_valid else None,
            "plate_format": best_valid.plate_format if best_valid else "invalid",
            "confidence": round(best_valid.confidence if best_valid else (best_any.confidence if best_any else 0.0), 4),
            "candidates": [asdict(candidate) for candidate in ranked],
            "corrections_applied": best_valid.corrections_applied if best_valid else [],
        }

        if debug_urls:
            result["debug_images_paths"] = debug_urls

        return result

    @staticmethod
    def _save_debug_image(
        debug_directory: Path | None,
        debug_url_prefix: str | None,
        name: str,
        image: np.ndarray,
    ) -> str | None:
        if debug_directory is None or debug_url_prefix is None:
            return None

        file_name = f"{slugify(name)}.png"
        file_path = debug_directory / file_name
        cv2.imwrite(str(file_path), image)
        return f"{debug_url_prefix}/{file_name}".replace("\\", "/")


def decode_image_data(data_url_or_base64: str) -> np.ndarray:
    encoded = data_url_or_base64

    if data_url_or_base64.startswith("data:"):
        _, _, encoded = data_url_or_base64.partition(",")

    try:
        image_bytes = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValueError("Imagem base64 inválida para OCR.") from error

    image_buffer = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_buffer, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Não foi possível decodificar a imagem enviada.")

    return image


def locate_plate_regions(
    image: np.ndarray,
    *,
    roi: dict[str, float | int] | None = None,
) -> tuple[list[PlateRegion], np.ndarray]:
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.4, tileGridSize=(8, 8)).apply(gray)
    filtered = cv2.bilateralFilter(clahe, 7, 50, 50)
    gradient_x = cv2.Sobel(filtered, cv2.CV_32F, 1, 0, ksize=3)
    gradient_x = cv2.convertScaleAbs(gradient_x)
    blurred = cv2.GaussianBlur(gradient_x, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    morph_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (17, 5))
    morphed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, morph_kernel, iterations=2)
    morphed = cv2.dilate(morphed, None, iterations=1)
    edges = cv2.Canny(filtered, 80, 180)
    contour_result = cv2.findContours(morphed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = contour_result[0] if len(contour_result) == 2 else contour_result[1]

    if roi:
        user_region = roi_to_region(image, roi)
        return [user_region], draw_region_debug(image, [user_region])

    image_area = float(height * width)
    regions: list[PlateRegion] = []

    for contour in contours:
        x, y, region_width, region_height = cv2.boundingRect(contour)
        if region_width <= 0 or region_height <= 0:
            continue

        aspect_ratio = region_width / max(region_height, 1)
        area_ratio = (region_width * region_height) / image_area

        if aspect_ratio < 1.2 or aspect_ratio > 6.8:
            continue

        if area_ratio < 0.004 or area_ratio > 0.25:
            continue

        contour_area = cv2.contourArea(contour)
        rectangularity = contour_area / max(region_width * region_height, 1)
        edge_density = edges[y : y + region_height, x : x + region_width].mean() / 255.0
        contrast = gray[y : y + region_height, x : x + region_width].std() / 128.0
        center_x = (x + region_width / 2) / width
        center_y = (y + region_height / 2) / height
        center_bias = 1.0 - min(abs(center_x - 0.5) * 1.2 + abs(center_y - 0.66) * 1.1, 1.0)
        car_shape_score = 1.0 - min(abs(aspect_ratio - 4.2) / 3.2, 1.0)
        moto_shape_score = 1.0 - min(abs(aspect_ratio - 1.8) / 1.2, 1.0)
        shape_score = max(car_shape_score, moto_shape_score)
        score = (
            (shape_score * 0.35)
            + (rectangularity * 0.2)
            + (edge_density * 0.2)
            + (max(0.0, min(contrast, 1.0)) * 0.1)
            + (center_bias * 0.15)
        )

        expanded = expand_region(
            PlateRegion(
                x=x,
                y=y,
                width=region_width,
                height=region_height,
                score=score,
                source="opencv-contour",
            ),
            width,
            height,
            padding_ratio=0.08,
        )
        regions.append(expanded)

    if not regions:
        regions = fallback_regions(width, height)

    sorted_regions = sorted(regions, key=lambda region: region.score, reverse=True)
    deduped_regions = dedupe_regions(sorted_regions, limit=4)
    return deduped_regions, draw_region_debug(image, deduped_regions)


def generate_plate_variants(image: np.ndarray) -> dict[str, np.ndarray]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.6, tileGridSize=(8, 8)).apply(gray)
    denoised = cv2.fastNlMeansDenoising(clahe, None, 14, 7, 21)
    sharpen_kernel = np.array([[0, -0.7, 0], [-0.7, 3.8, -0.7], [0, -0.7, 0]], dtype=np.float32)
    sharpened = cv2.filter2D(denoised, -1, sharpen_kernel)
    upscaled_gray = upscale_image(gray)
    upscaled_clahe = upscale_image(clahe)
    upscaled_denoised = upscale_image(denoised)
    upscaled_sharpened = upscale_image(sharpened)
    adaptive = cv2.adaptiveThreshold(
        upscaled_sharpened,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )
    _, otsu = cv2.threshold(
        upscaled_sharpened,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )

    return {
        "grayscale": upscaled_gray,
        "clahe": upscaled_clahe,
        "denoised": upscaled_denoised,
        "sharpen": upscaled_sharpened,
        "adaptive_threshold": adaptive,
        "otsu_threshold": otsu,
        "otsu_inverted": cv2.bitwise_not(otsu),
    }


def build_raw_candidates(
    observations: list[OCRTextObservation], source: str
) -> list[tuple[str, float, str]]:
    cleaned_observations = [
        OCRTextObservation(text=observation.text.strip(), confidence=observation.confidence)
        for observation in observations
        if observation.text.strip()
    ]

    if not cleaned_observations:
        return []

    candidates = [
        (observation.text, observation.confidence, source) for observation in cleaned_observations
    ]
    if len(cleaned_observations) > 1:
        joined = "".join(observation.text for observation in cleaned_observations)
        candidates.append(
            (
                joined,
                float(mean(observation.confidence for observation in cleaned_observations)),
                f"{source}:joined",
            )
        )

    return candidates


def score_candidate(raw_text: str, confidence: float, source: str) -> RankedCandidate:
    sanitized = sanitize_text(raw_text)

    if len(sanitized) != 7:
        return RankedCandidate(
            source=source,
            raw_text=raw_text,
            sanitized_text=sanitized,
            normalized_text=None,
            plate_format="invalid",
            confidence=round(confidence, 4),
            corrections_applied=[],
            corrections_count=0,
            valid=False,
        )

    scored_options: list[RankedCandidate] = []

    for plate_format, mask in (("old_br", "LLLNNNN"), ("mercosul", "LLLNLNN")):
        normalized, corrections = apply_mask_corrections(sanitized, mask, plate_format)

        if normalized is None:
            continue

        regex = OLD_BR_REGEX if plate_format == "old_br" else MERCOSUL_REGEX
        if not regex.match(normalized):
            continue

        scored_options.append(
            RankedCandidate(
                source=source,
                raw_text=raw_text,
                sanitized_text=sanitized,
                normalized_text=normalized,
                plate_format=plate_format,
                confidence=round(confidence, 4),
                corrections_applied=corrections,
                corrections_count=len(corrections),
                valid=True,
            )
        )

    if not scored_options:
        return RankedCandidate(
            source=source,
            raw_text=raw_text,
            sanitized_text=sanitized,
            normalized_text=None,
            plate_format="invalid",
            confidence=round(confidence, 4),
            corrections_applied=[],
            corrections_count=0,
            valid=False,
        )

    return sorted(
        scored_options,
        key=lambda candidate: (candidate.corrections_count, -candidate.confidence, candidate.plate_format),
    )[0]


def merge_and_rank(candidates: list[RankedCandidate]) -> list[RankedCandidate]:
    merged: dict[str, RankedCandidate] = {}

    for candidate in candidates:
        key = candidate.normalized_text if candidate.valid and candidate.normalized_text else f"invalid:{candidate.sanitized_text}"
        existing = merged.get(key)

        if existing is None:
            merged[key] = candidate
            continue

        previous_confidence = existing.confidence
        existing.occurrences += 1

        current_is_better = (
            candidate.valid and not existing.valid
            or (
                candidate.valid == existing.valid
                and (
                    candidate.corrections_count < existing.corrections_count
                    or (
                        candidate.corrections_count == existing.corrections_count
                        and candidate.confidence > previous_confidence
                    )
                )
            )
        )

        if current_is_better:
            existing.source = candidate.source
            existing.raw_text = candidate.raw_text
            existing.sanitized_text = candidate.sanitized_text
            existing.normalized_text = candidate.normalized_text
            existing.plate_format = candidate.plate_format
            existing.corrections_applied = candidate.corrections_applied
            existing.corrections_count = candidate.corrections_count
            existing.valid = candidate.valid

        existing.confidence = max(previous_confidence, candidate.confidence)

    return sorted(
        merged.values(),
        key=lambda candidate: (
            0 if candidate.valid else 1,
            -candidate.confidence,
            candidate.corrections_count,
            -candidate.occurrences,
            candidate.raw_text,
        ),
    )


def apply_mask_corrections(
    candidate: str,
    mask: str,
    plate_format: str,
) -> tuple[str | None, list[str]]:
    output: list[str] = []
    corrections: list[str] = []

    for index, expected in enumerate(mask):
        char = candidate[index]

        if expected == "L":
            if char.isalpha():
                output.append(char)
                continue

            replacement = DIGIT_TO_LETTER.get(char)
            if replacement is None:
                return None, []

            output.append(replacement)
            corrections.append(f"{plate_format}:pos{index + 1}:{char}->{replacement}")
            continue

        if char.isdigit():
            output.append(char)
            continue

        replacement = LETTER_TO_DIGIT.get(char)
        if replacement is None:
            return None, []

        output.append(replacement)
        corrections.append(f"{plate_format}:pos{index + 1}:{char}->{replacement}")

    return "".join(output), corrections


def sanitize_text(value: str) -> str:
    return NON_ALNUM_REGEX.sub("", value).upper()


def upscale_image(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    scale = 3.0 if max(height, width) < 180 else 2.0
    return cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)


def crop_region(image: np.ndarray, region: PlateRegion) -> np.ndarray:
    return image[region.y : region.y + region.height, region.x : region.x + region.width]


def expand_region(
    region: PlateRegion,
    max_width: int,
    max_height: int,
    *,
    padding_ratio: float,
) -> PlateRegion:
    pad_x = int(region.width * padding_ratio)
    pad_y = int(region.height * padding_ratio)
    x = max(0, region.x - pad_x)
    y = max(0, region.y - pad_y)
    right = min(max_width, region.x + region.width + pad_x)
    bottom = min(max_height, region.y + region.height + pad_y)

    return PlateRegion(
        x=x,
        y=y,
        width=right - x,
        height=bottom - y,
        score=region.score,
        source=region.source,
    )


def roi_to_region(image: np.ndarray, roi: dict[str, float | int]) -> PlateRegion:
    height, width = image.shape[:2]
    x = float(roi["x"])
    y = float(roi["y"])
    region_width = float(roi["width"])
    region_height = float(roi["height"])

    if max(x, y, region_width, region_height) <= 1.0:
        x *= width
        y *= height
        region_width *= width
        region_height *= height

    normalized = PlateRegion(
        x=max(0, int(round(x))),
        y=max(0, int(round(y))),
        width=max(1, int(round(region_width))),
        height=max(1, int(round(region_height))),
        score=1.0,
        source="existing-roi",
    )

    return expand_region(normalized, width, height, padding_ratio=0.05)


def fallback_regions(width: int, height: int) -> list[PlateRegion]:
    return [
        PlateRegion(
            x=int(width * 0.18),
            y=int(height * 0.46),
            width=int(width * 0.64),
            height=int(height * 0.3),
            score=0.35,
            source="fallback-lower-center",
        ),
        PlateRegion(
            x=int(width * 0.24),
            y=int(height * 0.53),
            width=int(width * 0.52),
            height=int(height * 0.22),
            score=0.25,
            source="fallback-tight-center",
        ),
    ]


def dedupe_regions(regions: list[PlateRegion], *, limit: int) -> list[PlateRegion]:
    selected: list[PlateRegion] = []

    for region in regions:
        if any(iou(region, candidate) > 0.75 for candidate in selected):
            continue

        selected.append(region)
        if len(selected) == limit:
            break

    return selected


def iou(a: PlateRegion, b: PlateRegion) -> float:
    left = max(a.x, b.x)
    top = max(a.y, b.y)
    right = min(a.x + a.width, b.x + b.width)
    bottom = min(a.y + a.height, b.y + b.height)

    if right <= left or bottom <= top:
        return 0.0

    intersection = (right - left) * (bottom - top)
    union = (a.width * a.height) + (b.width * b.height) - intersection
    return intersection / max(union, 1)


def draw_region_debug(image: np.ndarray, regions: list[PlateRegion]) -> np.ndarray:
    debug = image.copy()

    for index, region in enumerate(regions):
        cv2.rectangle(
            debug,
            (region.x, region.y),
            (region.x + region.width, region.y + region.height),
            (0, 255, 0),
            2,
        )
        cv2.putText(
            debug,
            f"{index + 1}:{region.source}:{region.score:.2f}",
            (region.x, max(18, region.y - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (0, 255, 0),
            1,
            cv2.LINE_AA,
        )

    return debug


def slugify(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()


def _coerce_prediction_payload(prediction: Any) -> dict[str, Any]:
    if isinstance(prediction, dict):
        payload = prediction.get("res")
        return payload if isinstance(payload, dict) else prediction

    if hasattr(prediction, "res") and isinstance(prediction.res, dict):
        return prediction.res

    if hasattr(prediction, "__dict__") and isinstance(prediction.__dict__.get("res"), dict):
        return prediction.__dict__["res"]

    raise RuntimeError(
        f"Formato inesperado do resultado do PaddleOCR: {type(prediction).__name__}"
    )


def run_from_json(payload: str, *, ocr_engine: OCREngine | None = None) -> dict[str, Any]:
    data = json.loads(payload)
    image = decode_image_data(data["image_data_url"])
    pipeline = BrazilianPlatePipeline(ocr_engine=ocr_engine)
    return pipeline.process(
        image,
        roi=data.get("roi"),
        request_id=data.get("request_id"),
        debug_dir=data.get("debug_dir"),
        debug_url_prefix=data.get("debug_url_prefix"),
    )
