from __future__ import annotations

import unittest
from pathlib import Path

import cv2
import numpy as np

from plate_ocr.pipeline import (
    BrazilianPlatePipeline,
    OCRTextObservation,
    merge_and_rank,
    score_candidate,
)


class FakeOCREngine:
    def __init__(self, responses: dict[str, list[OCRTextObservation]]):
        self.responses = responses

    def recognize(self, image_path: Path) -> list[OCRTextObservation]:
        file_name = image_path.name

        for key, response in self.responses.items():
            if key != "*" and key in file_name:
                return response

        return self.responses.get("*", [])


def build_vehicle_scene(*, dark: bool = False, motorcycle: bool = False) -> np.ndarray:
    canvas = np.full((720, 1280, 3), 24 if dark else 110, dtype=np.uint8)
    car_color = (40, 40, 40) if dark else (70, 70, 70)
    plate_color = (230, 230, 230) if dark else (245, 245, 245)
    text_color = (16, 16, 16)

    cv2.rectangle(canvas, (250, 120), (1030, 620), car_color, -1)
    cv2.circle(canvas, (340, 620), 70, (20, 20, 20), -1)
    cv2.circle(canvas, (940, 620), 70, (20, 20, 20), -1)

    if motorcycle:
        x, y, width, height = 540, 380, 190, 145
        cv2.rectangle(canvas, (x, y), (x + width, y + height), plate_color, -1)
        cv2.rectangle(canvas, (x, y), (x + width, y + height), (0, 0, 0), 3)
        cv2.putText(canvas, "ABC", (x + 24, y + 48), cv2.FONT_HERSHEY_SIMPLEX, 1.15, text_color, 3)
        cv2.putText(canvas, "1D23", (x + 18, y + 112), cv2.FONT_HERSHEY_SIMPLEX, 1.35, text_color, 3)
    else:
        x, y, width, height = 470, 450, 320, 92
        cv2.rectangle(canvas, (x, y), (x + width, y + height), plate_color, -1)
        cv2.rectangle(canvas, (x, y), (x + width, y + height), (0, 0, 0), 3)
        cv2.putText(canvas, "FMM6A10", (x + 20, y + 62), cv2.FONT_HERSHEY_SIMPLEX, 1.65, text_color, 3)

    if dark:
        shadow = np.zeros_like(canvas)
        cv2.rectangle(shadow, (0, 0), (1280, 720), (18, 18, 18), -1)
        canvas = cv2.addWeighted(canvas, 0.75, shadow, 0.25, 0)

    return canvas


class PlatePipelineTests(unittest.TestCase):
    def test_valid_plate_in_normal_photo(self) -> None:
        pipeline = BrazilianPlatePipeline(
            ocr_engine=FakeOCREngine({"*": [OCRTextObservation("FMM6A10", 0.93)]})
        )

        result = pipeline.process(build_vehicle_scene())

        self.assertEqual(result["plate_normalized"], "FMM6A10")
        self.assertEqual(result["plate_format"], "mercosul")
        self.assertGreater(result["confidence"], 0.9)

    def test_valid_plate_in_dark_photo(self) -> None:
        pipeline = BrazilianPlatePipeline(
            ocr_engine=FakeOCREngine({"*": [OCRTextObservation("FMM6A10", 0.88)]})
        )

        result = pipeline.process(build_vehicle_scene(dark=True))

        self.assertEqual(result["plate_normalized"], "FMM6A10")
        self.assertEqual(result["plate_format"], "mercosul")

    def test_motorcycle_plate(self) -> None:
        pipeline = BrazilianPlatePipeline(
            ocr_engine=FakeOCREngine({"*": [OCRTextObservation("ABC1D23", 0.9)]})
        )

        result = pipeline.process(build_vehicle_scene(motorcycle=True))

        self.assertEqual(result["plate_normalized"], "ABC1D23")
        self.assertEqual(result["plate_format"], "mercosul")

    def test_false_positive_with_eight_characters_is_rejected(self) -> None:
        pipeline = BrazilianPlatePipeline(
            ocr_engine=FakeOCREngine({"*": [OCRTextObservation("PDVJE0AX", 0.97)]})
        )

        result = pipeline.process(build_vehicle_scene())

        self.assertIsNone(result["plate_normalized"])
        self.assertEqual(result["plate_format"], "invalid")
        self.assertEqual(result["plate_raw"], "PDVJE0AX")

    def test_ambiguity_correction_for_o_and_i(self) -> None:
        candidate = score_candidate("FMM6AIO", 0.82, "unit")

        self.assertTrue(candidate.valid)
        self.assertEqual(candidate.normalized_text, "FMM6A10")
        self.assertEqual(candidate.corrections_count, 2)
        self.assertIn("mercosul:pos6:I->1", candidate.corrections_applied)
        self.assertIn("mercosul:pos7:O->0", candidate.corrections_applied)

    def test_valid_plate_is_prioritized_over_invalid_high_confidence_read(self) -> None:
        candidates = merge_and_rank(
            [
                score_candidate("PDVJE0AX", 0.98, "variant-a"),
                score_candidate("FMM6A10", 0.81, "variant-b"),
            ]
        )

        self.assertEqual(candidates[0].normalized_text, "FMM6A10")
        self.assertTrue(candidates[0].valid)


if __name__ == "__main__":
    unittest.main()
