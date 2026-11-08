"""Measurement library from the user-owned Star Garden asset checker.
No session paths, standalone HTML reporting, image generation, or automatic art approval.
See defense/docs/art/sd-pipeline/CHECKER_PROVENANCE.json.
"""

from __future__ import annotations

import argparse

import html

import json

import math

import os

import sys

import time

import traceback

from datetime import datetime

from pathlib import Path

import numpy as np

from PIL import Image, ImageDraw, ImageFont

from skimage.metrics import structural_similarity

from imgutils.detect import detect_faces, detect_heads

from imgutils.metrics import (
    ccip_batch_differences,
    ccip_batch_extract_features,
    ccip_default_threshold,
    lpips_difference,
)

CELL = 512

SHEET = 1024

PAD = 0.15

ALPHA_FOOT = 32

FOOT_BAND = 12

DIRECTIONS = ("front", "back", "sideA", "sideB")

FACE_DIRECTIONS = ("front", "sideA", "sideB")

CELL_BOXES = {
    "front": (0, 0, 512, 512),
    "back": (512, 0, 1024, 512),
    "sideA": (0, 512, 512, 1024),
    "sideB": (512, 512, 1024, 1024),
}

RATIO_LO = 0.92

RATIO_HI = 1.08

SIDE_DIFF_PCT = 6.0

FACE_TOP_PX = 8.0

FOOT_PX = 3.0

FACE_HEIGHT_BAND = 0.08

def log(message: str) -> None:
    print(message, flush=True)

def finite(value):
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return number

def clean(value):
    """Convert numpy values into JSON-safe Python values."""
    if value is None:
        return None
    if isinstance(value, dict):
        return {str(k): clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean(v) for v in value]
    if isinstance(value, np.ndarray):
        return clean(value.tolist())
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        number = float(value)
        return None if not math.isfinite(number) else round(number, 6)
    if isinstance(value, float):
        return None if not math.isfinite(value) else round(value, 6)
    if isinstance(value, (str, int, bool)):
        return value
    return str(value)

def dist_stats(values) -> dict:
    data = np.array([v for v in values if finite(v) is not None], dtype=np.float64)
    if data.size == 0:
        return {
            "n": 0,
            "min": None,
            "q1": None,
            "median": None,
            "q3": None,
            "iqr": None,
            "p80": None,
            "max": None,
            "mean": None,
        }
    q1, median, q3, p80 = np.percentile(data, [25, 50, 75, 80], method="linear")
    return {
        "n": int(data.size),
        "min": float(data.min()),
        "q1": float(q1),
        "median": float(median),
        "q3": float(q3),
        "iqr": float(q3 - q1),
        "p80": float(p80),
        "max": float(data.max()),
        "mean": float(data.mean()),
    }

def character_name(path: Path, group: str) -> str:
    stem = path.stem
    if group == "new" and stem.endswith("-new"):
        return stem[: -len("-new")]
    if group == "new2" and stem.endswith("-new2"):
        return stem[: -len("-new2")]
    return stem

def load_sheet(path: Path) -> tuple[Image.Image, dict]:
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    note = None
    if (width, height) != (SHEET, SHEET):
        note = (
            f"source is {width}x{height}, not {SHEET}x{SHEET}; "
            f"resized to {SHEET}x{SHEET} (scale x={SHEET / width:.6f}, "
            f"y={SHEET / height:.6f}) and split into equal 2x2 cells of {CELL}px. "
            "Measurements below are in that 512-cell space."
        )
        image = image.resize((SHEET, SHEET), Image.Resampling.LANCZOS)
    meta = {
        "original_size": [width, height],
        "working_size": [SHEET, SHEET],
        "size_note": note,
    }
    return image, meta

def composite_white(image: Image.Image) -> Image.Image:
    background = Image.new("RGB", image.size, (255, 255, 255))
    background.paste(image, mask=image.getchannel("A"))
    return background

def alpha_metrics(image: Image.Image) -> dict:
    alpha = np.asarray(image.getchannel("A"))
    opaque = alpha > 0
    ink = alpha > ALPHA_FOOT
    out = {
        "alpha_bbox": None,
        "alpha_width": None,
        "alpha_height": None,
        "foot_y": None,
        "foot_x": None,
    }
    ys, xs = np.where(opaque)
    if xs.size:
        x0 = int(xs.min())
        y0 = int(ys.min())
        x1 = int(xs.max()) + 1
        y1 = int(ys.max()) + 1
        out["alpha_bbox"] = [x0, y0, x1, y1]
        out["alpha_width"] = x1 - x0
        out["alpha_height"] = y1 - y0
    rows = np.where(ink.any(axis=1))[0]
    if rows.size:
        foot_y = int(rows.max())
        y0 = max(0, foot_y - (FOOT_BAND - 1))
        band = ink[y0 : foot_y + 1]
        yy, xx = np.where(band)
        out["foot_y"] = foot_y
        if xx.size:
            out["foot_x"] = float(xx.mean())
    return out

def detection_record(dets, kind: str) -> dict | None:
    parsed = []
    for box, _label, score in dets or []:
        x0, y0, x1, y1 = [int(v) for v in box]
        parsed.append(
            {
                "box": [x0, y0, x1, y1],
                "score": float(score),
                "width": int(x1 - x0),
                "height": int(y1 - y0),
            }
        )
    parsed.sort(key=lambda item: (item["score"], item["width"] * item["height"]), reverse=True)
    chosen = None
    for item in parsed:
        if item["width"] > 0 and item["height"] > 0:
            chosen = {
                "box": item["box"],
                "score": item["score"],
                "width": item["width"],
                "height": item["height"],
                "count": len(parsed),
            }
            break
    return {
        "chosen": chosen,
        "all": parsed,
        "kind": kind,
    }

def box_of(det) -> list | None:
    if not det or not det.get("chosen"):
        return None
    return det["chosen"]["box"]

def expand_box(box, pad: float, width: int, height: int):
    if box is None:
        return None
    x0, y0, x1, y1 = box
    bw = max(1, x1 - x0)
    bh = max(1, y1 - y0)
    nx0 = max(0, int(math.floor(x0 - bw * pad)))
    ny0 = max(0, int(math.floor(y0 - bh * pad)))
    nx1 = min(width, int(math.ceil(x1 + bw * pad)))
    ny1 = min(height, int(math.ceil(y1 + bh * pad)))
    if nx1 <= nx0 or ny1 <= ny0:
        return None
    return (nx0, ny0, nx1, ny1)

def crop_box(image: Image.Image, box) -> Image.Image | None:
    if box is None:
        return None
    return image.crop(tuple(box))

def ssim_gray(left: Image.Image, right: Image.Image):
    g1 = np.asarray(left.convert("L"), dtype=np.float64)
    g2 = np.asarray(right.convert("L"), dtype=np.float64)
    if g1.shape != g2.shape or g1.size == 0:
        return None
    short = min(g1.shape)
    if short < 3:
        return None
    window = 7 if short >= 7 else (short if short % 2 == 1 else short - 1)
    if window < 3:
        return None
    try:
        score = structural_similarity(g1, g2, win_size=window, data_range=255)
    except ValueError:
        return None
    return float(score)

def mirror_pair(side_a: Image.Image, side_b: Image.Image, box_a, box_b) -> dict:
    """Pad 15%, flip side A, resize the flip to the side B crop, then LPIPS and SSIM."""
    result = {
        "sideA_crop": list(box_a) if box_a else None,
        "sideB_crop": list(box_b) if box_b else None,
        "lpips": None,
        "ssim": None,
        "error": None,
    }
    crop_a = crop_box(side_a, box_a)
    crop_b = crop_box(side_b, box_b)
    if crop_a is None or crop_b is None:
        result["error"] = "missing crop"
        return result
    flipped = crop_a.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    resized = flipped.resize(crop_b.size, Image.Resampling.LANCZOS)
    try:
        result["lpips"] = float(lpips_difference(resized, crop_b))
    except Exception as exc:  # noqa: BLE001 — record and continue
        result["error"] = f"lpips: {exc}"
    result["ssim"] = ssim_gray(resized, crop_b)
    return result

def measure_geometry(path: Path, group: str) -> dict:
    sheet, size_meta = load_sheet(path)
    character = character_name(path, group)
    directions = {}
    rgb_cells = {}
    for name, box in CELL_BOXES.items():
        cell = sheet.crop(box)
        rgb = composite_white(cell)
        rgb_cells[name] = rgb
        alpha = alpha_metrics(cell)
        face_raw = None
        head_raw = None
        errors = []
        try:
            head_raw = detection_record(detect_heads(rgb), "head")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"head: {exc}")
            head_raw = detection_record([], "head")
        if name == "back":
            face_raw = detection_record([], "face")
            face_raw["expected"] = False
        else:
            try:
                face_raw = detection_record(detect_faces(rgb), "face")
            except Exception as exc:  # noqa: BLE001
                errors.append(f"face: {exc}")
                face_raw = detection_record([], "face")
            face_raw["expected"] = True
        directions[name] = {
            "face": face_raw,
            "head": head_raw,
            **alpha,
            "errors": errors,
        }

    def chosen(name, kind):
        return directions[name][kind]["chosen"]

    def height_of(name, kind):
        item = chosen(name, kind)
        return None if item is None else item["height"]

    def width_of(name, kind):
        item = chosen(name, kind)
        return None if item is None else item["width"]

    def edge(name, kind, index):
        item = chosen(name, kind)
        if item is None:
            return None
        return item["box"][index]

    face_h = {name: height_of(name, "face") for name in FACE_DIRECTIONS}
    face_w = {name: width_of(name, "face") for name in FACE_DIRECTIONS}
    front_h = face_h["front"]

    def ratio(part):
        if front_h in (None, 0) or face_h[part] is None:
            return None
        return face_h[part] / front_h

    side_px = None
    side_pct = None
    if face_h["sideA"] is not None and face_h["sideB"] is not None:
        side_px = face_h["sideA"] - face_h["sideB"]
        mean_h = (face_h["sideA"] + face_h["sideB"]) / 2
        if mean_h:
            side_pct = abs(side_px) / mean_h * 100

    face_top = {name: edge(name, "face", 1) for name in FACE_DIRECTIONS}
    face_bottom = {name: edge(name, "face", 3) for name in FACE_DIRECTIONS}
    head_top = {name: edge(name, "head", 1) for name in DIRECTIONS}
    foot_y = {name: directions[name]["foot_y"] for name in DIRECTIONS}

    def sub(a, b):
        if a is None or b is None:
            return None
        return a - b

    chin = {}
    for name in FACE_DIRECTIONS:
        chin[name] = sub(foot_y[name], face_bottom[name])

    derived = {
        "face_width": face_w,
        "face_height": face_h,
        "face_height_ratio_sideA_front": ratio("sideA"),
        "face_height_ratio_sideB_front": ratio("sideB"),
        "face_height_diff_sideA_minus_sideB_px": side_px,
        "face_height_diff_side_pct": side_pct,
        "face_top": face_top,
        "face_bottom": face_bottom,
        "face_top_diff_vs_front": {
            "sideA": sub(face_top["sideA"], face_top["front"]),
            "sideB": sub(face_top["sideB"], face_top["front"]),
        },
        "face_bottom_diff_vs_front": {
            "sideA": sub(face_bottom["sideA"], face_bottom["front"]),
            "sideB": sub(face_bottom["sideB"], face_bottom["front"]),
        },
        "head_top": head_top,
        "head_top_diff_vs_front": {
            name: sub(head_top[name], head_top["front"]) for name in ("back", "sideA", "sideB")
        },
        "chin_to_foot": chin,
        "chin_to_foot_diff_vs_front": {
            "sideA": sub(chin["sideA"], chin["front"]),
            "sideB": sub(chin["sideB"], chin["front"]),
        },
        "foot_y": foot_y,
        "foot_x": {name: directions[name]["foot_x"] for name in DIRECTIONS},
        "foot_diff_vs_front": {
            name: sub(foot_y[name], foot_y["front"]) for name in ("back", "sideA", "sideB")
        },
        "alpha_height": {name: directions[name]["alpha_height"] for name in DIRECTIONS},
        "alpha_bbox": {name: directions[name]["alpha_bbox"] for name in DIRECTIONS},
    }

    safe = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in character)
    image_stub = f"{group}_{safe}"
    return {
        "character": character,
        "group": group,
        "file": path.name,
        "path": str(path),
        "image_stub": image_stub,
        **size_meta,
        "directions": directions,
        "derived": derived,
        "_rgb": rgb_cells,
    }

def attach_similarity(record: dict) -> None:
    rgb = record["_rgb"]
    faces = {name: record["directions"][name]["face"] for name in DIRECTIONS}
    side_a_face = expand_box(box_of(faces["sideA"]), PAD, CELL, CELL)
    side_b_face = expand_box(box_of(faces["sideB"]), PAD, CELL, CELL)
    heads = {name: record["directions"][name]["head"] for name in DIRECTIONS}
    side_a_head = expand_box(box_of(heads["sideA"]), PAD, CELL, CELL)
    side_b_head = expand_box(box_of(heads["sideB"]), PAD, CELL, CELL)
    record["mirror"] = {
        "pad": PAD,
        "note": (
            "side A crop is expanded by 15% of the box on each edge, flipped horizontally, "
            "and resized to the side B crop size before LPIPS and grayscale SSIM. "
            "The face strip shows the same padded crops at one shared scale and does not apply that resize."
        ),
        "face": mirror_pair(rgb["sideA"], rgb["sideB"], side_a_face, side_b_face),
        "head": mirror_pair(rgb["sideA"], rgb["sideB"], side_a_head, side_b_head),
    }

def attach_ccip(record: dict, features: dict) -> None:
    order = list(DIRECTIONS)
    feats = [features[name] for name in order]
    matrix = ccip_batch_differences(feats)
    index = {name: i for i, name in enumerate(order)}

    def at(a, b):
        return float(matrix[index[a], index[b]])

    record["ccip"] = {
        "front_back": at("front", "back"),
        "front_sideA": at("front", "sideA"),
        "front_sideB": at("front", "sideB"),
        "sideA_sideB": at("sideA", "sideB"),
    }

def score_records(records: list[dict], cast_records: list[dict]) -> dict:
    def values(rows, getter):
        return [getter(row) for row in rows]

    front_heights = values(
        cast_records, lambda row: row["derived"]["face_height"]["front"]
    )
    face_lpips = values(cast_records, lambda row: row["mirror"]["face"]["lpips"])
    head_lpips = values(cast_records, lambda row: row["mirror"]["head"]["lpips"])
    ccip_sides = []
    for row in cast_records:
        ccip_sides.append(row["ccip"]["front_sideA"])
        ccip_sides.append(row["ccip"]["front_sideB"])

    cast = {
        "n_atlases": len(cast_records),
        "front_face_height": dist_stats(front_heights),
        "face_height_ratio_sideA_front": dist_stats(
            values(cast_records, lambda row: row["derived"]["face_height_ratio_sideA_front"])
        ),
        "face_height_ratio_sideB_front": dist_stats(
            values(cast_records, lambda row: row["derived"]["face_height_ratio_sideB_front"])
        ),
        "face_height_diff_side_pct": dist_stats(
            values(cast_records, lambda row: row["derived"]["face_height_diff_side_pct"])
        ),
        "face_top_diff_sideA": dist_stats(
            values(cast_records, lambda row: row["derived"]["face_top_diff_vs_front"]["sideA"])
        ),
        "face_top_diff_sideB": dist_stats(
            values(cast_records, lambda row: row["derived"]["face_top_diff_vs_front"]["sideB"])
        ),
        "foot_diff_back": dist_stats(
            values(cast_records, lambda row: row["derived"]["foot_diff_vs_front"]["back"])
        ),
        "foot_diff_sideA": dist_stats(
            values(cast_records, lambda row: row["derived"]["foot_diff_vs_front"]["sideA"])
        ),
        "foot_diff_sideB": dist_stats(
            values(cast_records, lambda row: row["derived"]["foot_diff_vs_front"]["sideB"])
        ),
        "chin_to_foot_diff_sideA": dist_stats(
            values(cast_records, lambda row: row["derived"]["chin_to_foot_diff_vs_front"]["sideA"])
        ),
        "chin_to_foot_diff_sideB": dist_stats(
            values(cast_records, lambda row: row["derived"]["chin_to_foot_diff_vs_front"]["sideB"])
        ),
        "mirror_lpips_face": dist_stats(face_lpips),
        "mirror_lpips_head": dist_stats(head_lpips),
        "mirror_ssim_face": dist_stats(
            values(cast_records, lambda row: row["mirror"]["face"]["ssim"])
        ),
        "ccip_front_vs_side": dist_stats(ccip_sides),
        "ccip_front_back": dist_stats(
            values(cast_records, lambda row: row["ccip"]["front_back"])
        ),
        "ccip_sideA_sideB": dist_stats(
            values(cast_records, lambda row: row["ccip"]["sideA_sideB"])
        ),
        "ccip_model_same_character_threshold": None,
    }
    try:
        cast["ccip_model_same_character_threshold"] = float(ccip_default_threshold())
    except Exception as exc:  # noqa: BLE001
        cast["ccip_model_same_character_threshold_error"] = str(exc)

    height_stats = cast["front_face_height"]
    median = height_stats["median"]
    face_p80 = cast["mirror_lpips_face"]["p80"]
    head_p80 = cast["mirror_lpips_head"]["p80"]
    ccip_p80 = cast["ccip_front_vs_side"]["p80"]
    outside = []

    for row in records:
        flags = []
        score = 0.0
        derived = row["derived"]
        front_h = derived["face_height"]["front"]
        height_info = {
            "front_face_height": front_h,
            "cast_median": median,
            "ratio_to_median": None,
            "band_low": None if median is None else median * (1 - FACE_HEIGHT_BAND),
            "band_high": None if median is None else median * (1 + FACE_HEIGHT_BAND),
            "outside_median_pm_8pct": False,
        }
        if front_h is not None and median not in (None, 0):
            ratio_to_median = front_h / median
            height_info["ratio_to_median"] = ratio_to_median
            if ratio_to_median < (1 - FACE_HEIGHT_BAND) or ratio_to_median > (1 + FACE_HEIGHT_BAND):
                height_info["outside_median_pm_8pct"] = True
                excess = (abs(ratio_to_median - 1) - FACE_HEIGHT_BAND) / FACE_HEIGHT_BAND
                score += 2 * excess
                flags.append(
                    f"front face height {front_h:.0f}px is outside cast median {median:.1f}px ±8%"
                )
                if row["group"] == "installed":
                    outside.append(row["character"])
        elif front_h is None:
            flags.append("missing front face")
            score += 10

        for name, weight in (("sideA", 8), ("sideB", 8)):
            if derived["face_height"][name] is None:
                flags.append(f"missing {name} face")
                score += weight
        for name in DIRECTIONS:
            if row["directions"][name]["head"]["chosen"] is None:
                flags.append(f"missing {name} head")
                score += 6

        for name, key in (
            ("sideA", "face_height_ratio_sideA_front"),
            ("sideB", "face_height_ratio_sideB_front"),
        ):
            value = derived[key]
            if value is None:
                continue
            if value < RATIO_LO or value > RATIO_HI:
                distance = RATIO_LO - value if value < RATIO_LO else value - RATIO_HI
                score += 4 * (distance / (RATIO_HI - RATIO_LO))
                flags.append(
                    f"{name}/front face-height ratio {value:.4f} outside {RATIO_LO:.2f}-{RATIO_HI:.2f}"
                )

        pct = derived["face_height_diff_side_pct"]
        if pct is not None and pct > SIDE_DIFF_PCT:
            score += 3 * ((pct - SIDE_DIFF_PCT) / SIDE_DIFF_PCT)
            flags.append(
                f"sideA vs sideB face height differs by {abs(derived['face_height_diff_sideA_minus_sideB_px']):.0f}px ({pct:.1f}%)"
            )

        for name in ("sideA", "sideB"):
            delta = derived["face_top_diff_vs_front"][name]
            if delta is not None and abs(delta) > FACE_TOP_PX:
                score += 2 * ((abs(delta) - FACE_TOP_PX) / FACE_TOP_PX)
                flags.append(f"{name} face top is {delta:+.0f}px vs front")

        for name in ("back", "sideA", "sideB"):
            delta = derived["foot_diff_vs_front"][name]
            if delta is not None and abs(delta) > FOOT_PX:
                score += 2 * ((abs(delta) - FOOT_PX) / FOOT_PX)
                flags.append(f"{name} foot line is {delta:+.0f}px vs front")

        face_lp = row["mirror"]["face"]["lpips"]
        if face_p80 not in (None, 0) and face_lp is not None and face_lp > face_p80:
            score += 1.5 * ((face_lp - face_p80) / face_p80)
            flags.append(f"face mirror LPIPS {face_lp:.3f} > cast p80 {face_p80:.3f}")
        head_lp = row["mirror"]["head"]["lpips"]
        if head_p80 not in (None, 0) and head_lp is not None and head_lp > head_p80:
            score += 1.0 * ((head_lp - head_p80) / head_p80)
            flags.append(f"head mirror LPIPS {head_lp:.3f} > cast p80 {head_p80:.3f}")

        for name, key in (("sideA", "front_sideA"), ("sideB", "front_sideB")):
            value = row["ccip"][key]
            if ccip_p80 not in (None, 0) and value is not None and value > ccip_p80:
                score += 1.5 * ((value - ccip_p80) / ccip_p80)
                flags.append(f"CCIP front-{name} {value:.3f} > cast p80 {ccip_p80:.3f}")

        row["cast_face_height"] = height_info
        row["flags"] = flags
        row["review_score"] = score
        row["review_reasons"] = list(flags)

    cast["front_face_height_outside_median_pm_8pct"] = outside
    cast["thresholds"] = {
        "side_front_face_height_ratio": [RATIO_LO, RATIO_HI],
        "sideA_vs_sideB_face_height_diff_pct": SIDE_DIFF_PCT,
        "side_face_height_diff_definition": "abs(sideA - sideB) / mean(sideA, sideB) * 100",
        "face_band_top_diff_vs_front_px": FACE_TOP_PX,
        "foot_line_diff_vs_front_px": FOOT_PX,
        "mirror_lpips_face_p80": face_p80,
        "mirror_lpips_head_p80": head_p80,
        "ccip_front_vs_side_p80": ccip_p80,
        "front_face_height_median_pm_frac": FACE_HEIGHT_BAND,
        "percentile_method": "numpy linear, strictly greater than p80",
        "score": (
            "10 missing front face; 8 per missing side face; 6 per missing head; "
            "4 * how far a side/front face-height ratio sits outside 0.92-1.08, in units of 0.08; "
            "3 * (side face-height % diff - 6) / 6 when that diff exceeds 6; "
            "2 * (|face-top diff| - 8) / 8 per side when |diff| > 8px; "
            "2 * (|foot diff| - 3) / 3 per non-front direction when |diff| > 3px; "
            "1.5 * (face LPIPS - p80) / p80 when face mirror LPIPS exceeds the cast p80; "
            "1.0 * (head LPIPS - p80) / p80 when head mirror LPIPS exceeds its own cast p80; "
            "1.5 * (CCIP - p80) / p80 per front-vs-side CCIP above the cast p80; "
            "2 * (relative face-height distance beyond 8%) / 0.08 when front face height "
            "is outside the cast median ±8%. Higher means more review."
        ),
    }
    return cast

def cell(text, class_name="") -> str:
    return f'<span class="c{class_name}">{text}</span>'

def public_record(row: dict) -> dict:
    data = {key: value for key, value in row.items() if key != "_rgb"}
    return clean(data)

def batch_ccip(records: list[dict]) -> None:
    images = []
    index = {}
    for record_index, record in enumerate(records):
        for name in DIRECTIONS:
            index[(record_index, name)] = len(images)
            images.append(record["_rgb"][name])
    features = []
    batch = 8
    total = len(images)
    for start in range(0, total, batch):
        chunk = images[start : start + batch]
        log(f"ccip features {start + len(chunk)}/{total}")
        features.append(ccip_batch_extract_features(chunk))
    stacked = np.concatenate(features, axis=0) if features else np.zeros((0, 1))
    for record_index, record in enumerate(records):
        picked = {name: stacked[index[(record_index, name)]] for name in DIRECTIONS}
        attach_ccip(record, picked)
