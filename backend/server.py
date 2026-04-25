import os
import uuid
import base64
import tempfile
import logging
import csv
import statistics
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from pymongo.errors import PyMongoError

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

app = FastAPI(title="DeepFake Detector API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
in_memory_scans = []
client = None
db = None
scans_collection = None
db_available = False
REFERENCE_MODELS = {}


def initialize_database() -> None:
    global client, db, scans_collection, db_available

    if not MONGO_URL or not DB_NAME:
        logger.warning("MongoDB configuration missing. Falling back to in-memory scan storage.")
        db_available = False
        return

    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=1500, connectTimeoutMS=1500)
        client.admin.command("ping")
        db = client[DB_NAME]
        scans_collection = db["scans"]
        db_available = True
        logger.info("MongoDB connected successfully.")
    except PyMongoError as exc:
        logger.warning("MongoDB unavailable. Falling back to in-memory scan storage: %s", exc)
        client = None
        db = None
        scans_collection = None
        db_available = False


def save_scan(scan_record: dict) -> None:
    if db_available and scans_collection is not None:
        try:
            scans_collection.insert_one(scan_record)
            return
        except PyMongoError as exc:
            logger.warning("Failed to save scan to MongoDB. Using in-memory store: %s", exc)

    in_memory_scans.insert(0, dict(scan_record))


def list_scans(limit: int = 20, skip: int = 0) -> dict:
    if db_available and scans_collection is not None:
        try:
            scans = list(
                scans_collection.find({}, {"_id": 0})
                .sort("created_at", -1)
                .skip(skip)
                .limit(limit)
            )
            total = scans_collection.count_documents({})
            return {"scans": scans, "total": total}
        except PyMongoError as exc:
            logger.warning("Failed to load scans from MongoDB. Using in-memory store: %s", exc)

    scans = in_memory_scans[skip : skip + limit]
    return {"scans": scans, "total": len(in_memory_scans)}


def get_scan_record(scan_id: str) -> Optional[dict]:
    if db_available and scans_collection is not None:
        try:
            return scans_collection.find_one({"scan_id": scan_id}, {"_id": 0})
        except PyMongoError as exc:
            logger.warning("Failed to load scan from MongoDB. Using in-memory store: %s", exc)

    for scan in in_memory_scans:
        if scan.get("scan_id") == scan_id:
            return scan
    return None


def build_analytics() -> dict:
    if db_available and scans_collection is not None:
        try:
            total = scans_collection.count_documents({})
            real_count = scans_collection.count_documents({"verdict": "REAL"})
            fake_count = scans_collection.count_documents({"verdict": "FAKE"})
            recent = list(
                scans_collection.find(
                    {},
                    {"_id": 0, "scan_id": 1, "media_type": 1, "verdict": 1, "confidence": 1, "created_at": 1},
                )
                .sort("created_at", -1)
                .limit(10)
            )

            by_type = {}
            for media_type in ["image", "audio", "video"]:
                by_type[media_type] = {
                    "total": scans_collection.count_documents({"media_type": media_type}),
                    "real": scans_collection.count_documents({"media_type": media_type, "verdict": "REAL"}),
                    "fake": scans_collection.count_documents({"media_type": media_type, "verdict": "FAKE"}),
                }

            return {
                "total_scans": total,
                "real_count": real_count,
                "fake_count": fake_count,
                "inconclusive_count": total - real_count - fake_count,
                "by_type": by_type,
                "recent_scans": recent,
                "storage": "mongodb",
            }
        except PyMongoError as exc:
            logger.warning("Failed to load analytics from MongoDB. Using in-memory store: %s", exc)

    total = len(in_memory_scans)
    real_count = sum(1 for scan in in_memory_scans if scan.get("verdict") == "REAL")
    fake_count = sum(1 for scan in in_memory_scans if scan.get("verdict") == "FAKE")
    by_type = {}
    for media_type in ["image", "audio", "video"]:
        media_scans = [scan for scan in in_memory_scans if scan.get("media_type") == media_type]
        by_type[media_type] = {
            "total": len(media_scans),
            "real": sum(1 for scan in media_scans if scan.get("verdict") == "REAL"),
            "fake": sum(1 for scan in media_scans if scan.get("verdict") == "FAKE"),
        }

    return {
        "total_scans": total,
        "real_count": real_count,
        "fake_count": fake_count,
        "inconclusive_count": total - real_count - fake_count,
        "by_type": by_type,
        "recent_scans": in_memory_scans[:10],
        "storage": "memory",
    }


def read_csv_rows(file_path: str) -> list[dict]:
    if not os.path.exists(file_path):
        return []
    with open(file_path, "r", encoding="utf-8") as csv_file:
        return list(csv.DictReader(csv_file))


def to_float(value, default=0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def estimate_confusion_matrix(accuracy: float, precision: float, recall: float) -> dict:
    # Estimate a normalized binary confusion matrix assuming balanced classes.
    positives = 0.5
    negatives = 0.5
    tp = max(0.0, min(positives, recall * positives))
    fn = max(0.0, positives - tp)
    if precision <= 0:
        fp = max(0.0, negatives)
    else:
        fp = max(0.0, min(negatives, tp * ((1 / max(precision, 1e-6)) - 1)))
    tn = max(0.0, negatives - fp)

    # Blend with reported accuracy to reduce drift from the estimate.
    estimated_accuracy = tp + tn
    if estimated_accuracy > 0:
        scale = accuracy / estimated_accuracy
        tp *= scale
        tn *= scale
        fn = max(0.0, positives - tp)
        fp = max(0.0, negatives - tn)

    total = tp + tn + fp + fn
    if total <= 0:
        total = 1.0

    matrix = [
        [tp / total, fn / total],
        [fp / total, tn / total],
    ]
    return {
        "labels": ["Actual Fake", "Actual Real"],
        "predicted": ["Pred Fake", "Pred Real"],
        "values": matrix,
    }


def build_performance_payload() -> dict:
    overall_rows = read_csv_rows(os.path.join("reports", "model_evaluation_results.csv"))
    modality_rows = read_csv_rows(os.path.join("reports", "multimodal_model_evaluation_results.csv"))

    overall = [
        {
            "model": row["model"],
            "accuracy": to_float(row.get("accuracy")),
            "precision": to_float(row.get("precision")),
            "recall": to_float(row.get("recall")),
            "f1_score": to_float(row.get("f1_score")),
        }
        for row in overall_rows
    ]

    multimodal = [
        {
            "modality": row["modality"],
            "model": row["model"],
            "accuracy": to_float(row.get("accuracy")),
            "precision": to_float(row.get("precision")),
            "recall": to_float(row.get("recall")),
            "f1_score": to_float(row.get("f1_score")),
        }
        for row in modality_rows
    ]

    best_model = max(overall, key=lambda item: item["f1_score"], default=None)
    prediction_distribution = build_analytics()
    confusion_matrices = [
        {
            "model": item["model"],
            "matrix": estimate_confusion_matrix(item["accuracy"], item["precision"], item["recall"]),
        }
        for item in overall
    ]

    return {
        "overall_models": overall,
        "multimodal_models": multimodal,
        "best_model": best_model,
        "prediction_distribution": {
            "REAL": prediction_distribution.get("real_count", 0),
            "FAKE": prediction_distribution.get("fake_count", 0),
            "INCONCLUSIVE": prediction_distribution.get("inconclusive_count", 0),
        },
        "confusion_matrices": confusion_matrices,
        "notes": {
            "confusion_matrix": "Confusion matrices are normalized estimates derived from reported accuracy, precision, and recall because raw prediction logs are not stored in the repository."
        },
    }


initialize_database()

DEEPFAKE_SYSTEM_PROMPT = """You are an expert deepfake forensic analyst. Your job is to analyze uploaded media and determine if it is REAL or FAKE (AI-generated/manipulated).

For images, analyze:
- Facial features consistency (symmetry, skin texture, hair boundaries)
- Lighting and shadow consistency
- Background artifacts and blending edges
- Eye reflections and iris patterns
- Teeth and mouth region artifacts
- Resolution inconsistencies across regions
- JPEG/compression artifact patterns
- Color channel anomalies

For audio, analyze the spectrogram/waveform description:
- Unnatural pitch shifts or monotone patterns
- Missing ambient noise or room acoustics
- Robotic artifacts or glitches
- Inconsistent breathing patterns
- Splicing artifacts at boundaries

For video frames, analyze:
- Temporal consistency across frames
- Facial flickering or morphing artifacts
- Edge blending around face/hair boundaries
- Unnatural head movements or expressions

Respond in this EXACT JSON format:
{
  "verdict": "REAL" or "FAKE",
  "confidence": 0.0 to 1.0,
  "risk_level": "LOW" or "MEDIUM" or "HIGH" or "CRITICAL",
  "summary": "Brief 1-2 sentence summary",
  "details": [
    {"category": "Category Name", "finding": "Description", "severity": "low/medium/high"}
  ],
  "artifacts_detected": ["list of specific artifacts found"],
  "recommendation": "Brief recommendation"
}

Be thorough but honest. If the media appears genuine, say so. If you detect manipulation signs, explain them clearly."""



# --- LOCAL MODEL INFERENCE ONLY ---
import torch
import numpy as np
from PIL import Image
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.models.cnn import CNNModel

def compute_risk_level(verdict: str, confidence: float) -> str:
    if verdict == "INCONCLUSIVE":
        return "MEDIUM"
    if verdict == "FAKE":
        if confidence >= 0.9:
            return "CRITICAL"
        if confidence >= 0.75:
            return "HIGH"
        return "MEDIUM"
    if confidence >= 0.8:
        return "LOW"
    if confidence >= 0.6:
        return "MEDIUM"
    return "HIGH"


def confidence_from_probability(probability: float, verdict: str) -> float:
    return probability if verdict == "FAKE" else 1.0 - probability


def extract_image_feature_vector(image_source) -> np.ndarray:
    if isinstance(image_source, np.ndarray):
        img = Image.fromarray(image_source.astype(np.uint8)).convert("RGB")
    else:
        img = Image.open(image_source).convert("RGB")

    rgb = img.resize((64, 64))
    gray = rgb.convert("L")
    rgb_np = np.array(rgb).astype(np.float32) / 255.0
    gray_np = np.array(gray).astype(np.float32) / 255.0

    channel_means = rgb_np.mean(axis=(0, 1))
    channel_stds = rgb_np.std(axis=(0, 1))
    gray_mean = np.array([gray_np.mean(), gray_np.std()], dtype=np.float32)

    hist_features = []
    for channel_index in range(3):
        hist, _ = np.histogram(rgb_np[:, :, channel_index], bins=12, range=(0.0, 1.0), density=True)
        hist_features.extend(hist.tolist())

    grad_y, grad_x = np.gradient(gray_np)
    grad_mag = np.sqrt((grad_x ** 2) + (grad_y ** 2))
    texture_features = np.array(
        [
            grad_mag.mean(),
            grad_mag.std(),
            np.mean(np.abs(gray_np[:-1, :] - gray_np[1:, :])),
            np.mean(np.abs(gray_np[:, :-1] - gray_np[:, 1:])),
        ],
        dtype=np.float32,
    )

    feature_vector = np.concatenate(
        [channel_means, channel_stds, gray_mean, np.array(hist_features, dtype=np.float32), texture_features]
    )
    return feature_vector.astype(np.float32)


def extract_audio_feature_vector(audio_path: str) -> np.ndarray | None:
    features = extract_audio_features(audio_path)
    if features.get("duration") == "unknown":
        return None

    ordered_keys = [
        "sample_rate",
        "duration",
        "rms_energy",
        "zero_crossing_rate",
        "mfcc_mean",
        "mfcc_std",
        "spectral_centroid",
        "spectral_rolloff",
        "spectral_bandwidth",
        "pitch_std",
    ]
    return np.array([float(features[key]) for key in ordered_keys], dtype=np.float32)


def extract_video_feature_vector(video_path: str) -> tuple[np.ndarray | None, list[np.ndarray], list[int]]:
    try:
        import cv2
    except Exception as exc:
        logger.error("OpenCV unavailable during video feature extraction: %s", exc)
        return None, [], []

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None, []

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    sample_count = min(16, total_frames) if total_frames > 0 else 0
    if sample_count == 0:
        cap.release()
        return None, [], []

    indices = sorted({int(i * max(total_frames - 1, 0) / max(sample_count - 1, 1)) for i in range(sample_count)})
    frame_vectors = []
    brightness = []
    sharpness = []
    frame_indices = []
    motion = []
    previous_gray = None

    for current_index in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, current_index)
        ret, frame = cap.read()
        if not ret:
            continue
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frame_vec = extract_image_feature_vector(rgb_frame)
        frame_vectors.append(frame_vec)
        frame_indices.append(current_index)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        brightness.append(float(np.mean(gray)))
        sharpness.append(float(cv2.Laplacian(gray, cv2.CV_64F).var()))
        if previous_gray is not None:
            motion.append(float(np.mean(np.abs(gray.astype(np.float32) - previous_gray.astype(np.float32)))))
        previous_gray = gray

    cap.release()
    if not frame_vectors:
        return None, [], []

    aggregated = np.mean(np.stack(frame_vectors), axis=0)
    temporal = np.array(
        [
            float(np.std(brightness)) if brightness else 0.0,
            float(np.std(sharpness)) if sharpness else 0.0,
            float(np.mean(motion)) if motion else 0.0,
            float(np.std(motion)) if motion else 0.0,
            float(len(frame_vectors)),
        ],
        dtype=np.float32,
    )
    # Return both the video-level vector and the list of frame vectors
    return np.concatenate([aggregated, temporal]).astype(np.float32), frame_vectors, frame_indices


def normalize_reference_vector(extracted):
    if extracted is None:
        return None
    if isinstance(extracted, tuple):
        extracted = extracted[0]
    if extracted is None:
        return None
    return np.asarray(extracted, dtype=np.float32)


def build_reference_model(modality: str, extractor) -> dict:
    cache_key = f"{modality}_reference"
    if cache_key in REFERENCE_MODELS:
        return REFERENCE_MODELS[cache_key]

    raw_dir = os.path.join("data", "raw", f"{modality}s")
    vectors = {"REAL": [], "FAKE": []}
    entries = []

    if not os.path.isdir(raw_dir):
        raise FileNotFoundError(f"Reference data directory not found: {raw_dir}")

    for filename in os.listdir(raw_dir):
        lower = filename.lower()
        if lower.startswith("real_"):
            label = "REAL"
        elif lower.startswith("fake_"):
            label = "FAKE"
        else:
            continue

        file_path = os.path.join(raw_dir, filename)
        try:
            vector = normalize_reference_vector(extractor(file_path))
            if vector is not None:
                vectors[label].append(vector)
                entries.append({"label": label, "filename": filename, "vector": vector})
        except Exception as exc:
            logger.warning("Skipping reference %s file %s: %s", modality, filename, exc)

    if not vectors["REAL"] or not vectors["FAKE"]:
        raise RuntimeError(f"Not enough reference samples for {modality} classification.")

    real_vectors = np.stack(vectors["REAL"])
    fake_vectors = np.stack(vectors["FAKE"])
    model = {
        "real_centroid": real_vectors.mean(axis=0),
        "fake_centroid": fake_vectors.mean(axis=0),
        "real_spread": float(np.mean(np.linalg.norm(real_vectors - real_vectors.mean(axis=0), axis=1))) + 1e-6,
        "fake_spread": float(np.mean(np.linalg.norm(fake_vectors - fake_vectors.mean(axis=0), axis=1))) + 1e-6,
        "real_count": int(len(real_vectors)),
        "fake_count": int(len(fake_vectors)),
        "entries": entries,
    }
    REFERENCE_MODELS[cache_key] = model
    return model


def project_reference_model(model: dict, dimensions: int) -> dict:
    real_vectors = np.stack([entry["vector"][:dimensions] for entry in model["entries"] if entry["label"] == "REAL"])
    fake_vectors = np.stack([entry["vector"][:dimensions] for entry in model["entries"] if entry["label"] == "FAKE"])
    return {
        "real_centroid": real_vectors.mean(axis=0),
        "fake_centroid": fake_vectors.mean(axis=0),
        "real_spread": float(np.mean(np.linalg.norm(real_vectors - real_vectors.mean(axis=0), axis=1))) + 1e-6,
        "fake_spread": float(np.mean(np.linalg.norm(fake_vectors - fake_vectors.mean(axis=0), axis=1))) + 1e-6,
        "real_count": int(len(real_vectors)),
        "fake_count": int(len(fake_vectors)),
        "entries": [
            {
                "label": entry["label"],
                "filename": entry["filename"],
                "vector": entry["vector"][:dimensions],
            }
            for entry in model["entries"]
        ],
    }


def classify_with_reference_model(feature_vector: np.ndarray, model: dict) -> dict:
    real_distance = float(np.linalg.norm(feature_vector - model["real_centroid"]) / model["real_spread"])
    fake_distance = float(np.linalg.norm(feature_vector - model["fake_centroid"]) / model["fake_spread"])

    neighbor_distances = []
    for entry in model["entries"]:
        distance = float(np.linalg.norm(feature_vector - entry["vector"]))
        neighbor_distances.append((distance, entry["label"], entry["filename"]))
    neighbor_distances.sort(key=lambda item: item[0])
    nearest = neighbor_distances[: min(5, len(neighbor_distances))]

    real_weight = sum(1.0 / (distance + 1e-6) for distance, label, _ in nearest if label == "REAL")
    fake_weight = sum(1.0 / (distance + 1e-6) for distance, label, _ in nearest if label == "FAKE")
    fake_probability = fake_weight / (real_weight + fake_weight + 1e-6)
    verdict = "FAKE" if fake_weight > real_weight else "REAL"
    confidence = confidence_from_probability(fake_probability, verdict)
    return {
        "verdict": verdict,
        "confidence": confidence,
        "fake_probability": fake_probability,
        "real_distance": real_distance,
        "fake_distance": fake_distance,
        "nearest_neighbors": nearest,
    }

def analyze_image_local(file_path: str) -> dict:
    feature_vector = extract_image_feature_vector(file_path)
    model = build_reference_model("image", extract_image_feature_vector)
    classification = classify_with_reference_model(feature_vector, model)
    verdict = classification["verdict"]
    confidence = classification["confidence"]
    summary = f"The image is predicted as {verdict} with confidence {confidence:.2f} using similarity to known real and fake reference images."
    return {
        "verdict": verdict,
        "confidence": confidence,
        "risk_level": compute_risk_level(verdict, confidence),
        "summary": summary,
        "details": [
            {
                "category": "Reference Similarity",
                "finding": f"Distance to REAL cluster: {classification['real_distance']:.2f}; distance to FAKE cluster: {classification['fake_distance']:.2f}.",
                "severity": "low" if verdict == "REAL" else "high",
            },
            {
                "category": "Nearest Matches",
                "finding": "Closest references: " + ", ".join(
                    f"{name} ({label}, {distance:.2f})" for distance, label, name in classification["nearest_neighbors"][:3]
                ),
                "severity": "low",
            },
            {
                "category": "Dataset Calibration",
                "finding": f"Compared against {model['real_count']} real and {model['fake_count']} fake reference images from the local dataset.",
                "severity": "low",
            },
        ],
        "artifacts_detected": ["reference-matched anomaly pattern"] if verdict == "FAKE" else [],
        "recommendation": "For best results, use frontal, reasonably sharp face images similar in quality to the local dataset."
    }

def analyze_audio_local(file_path: str) -> dict:
    audio_features = extract_audio_features(file_path)
    feature_vector = extract_audio_feature_vector(file_path)
    if feature_vector is None:
        return {
            "verdict": "INCONCLUSIVE",
            "confidence": 0.5,
            "risk_level": "MEDIUM",
            "summary": "Audio features could not be extracted, so the scan is inconclusive.",
            "details": [
                {
                    "category": "Feature Extraction",
                    "finding": "Librosa could not derive stable audio features from the uploaded file.",
                    "severity": "medium",
                }
            ],
            "artifacts_detected": [],
            "recommendation": "Upload a clean WAV file or install missing audio codecs/dependencies.",
        }

    model = build_reference_model("audio", extract_audio_feature_vector)
    classification = classify_with_reference_model(feature_vector, model)
    verdict = classification["verdict"]
    confidence = classification["confidence"]
    artifacts_detected = []
    if float(audio_features["spectral_bandwidth"]) < 1500:
        artifacts_detected.append("narrow spectral bandwidth")
    if float(audio_features["mfcc_std"]) < 1.0:
        artifacts_detected.append("low timbre variance")
    if float(audio_features["zero_crossing_rate"]) > 0.15:
        artifacts_detected.append("noisy waveform crossings")

    details = [
        {
            "category": "Reference Similarity",
            "finding": f"Distance to REAL cluster: {classification['real_distance']:.2f}; distance to FAKE cluster: {classification['fake_distance']:.2f}.",
            "severity": "low" if verdict == "REAL" else "high",
        },
        {
            "category": "Nearest Matches",
            "finding": "Closest references: " + ", ".join(
                f"{name} ({label}, {distance:.2f})" for distance, label, name in classification["nearest_neighbors"][:3]
            ),
            "severity": "low",
        },
        {
            "category": "Spectral Profile",
            "finding": f"Bandwidth {audio_features['spectral_bandwidth']}, centroid {audio_features['spectral_centroid']}, zero-crossing rate {audio_features['zero_crossing_rate']}.",
            "severity": "medium",
        },
        {
            "category": "Dataset Calibration",
            "finding": f"Compared against {model['real_count']} real and {model['fake_count']} fake reference audio clips from the local dataset.",
            "severity": "low",
        },
    ]

    summary = f"Audio is predicted as {verdict} with confidence {confidence:.2f} using similarity to known real and fake reference audio patterns."
    return {
        "verdict": verdict,
        "confidence": confidence,
        "risk_level": compute_risk_level(verdict, confidence),
        "summary": summary,
        "details": details,
        "artifacts_detected": artifacts_detected,
        "recommendation": "Use speech clips with a few seconds of stable voice content for stronger audio matching against the local reference set."
    }

def analyze_video_local(file_path: str) -> dict:
    feature_vector, frame_vectors, frame_indices = extract_video_feature_vector(file_path)
    if feature_vector is None or not frame_vectors:
        return {
            "verdict": "INCONCLUSIVE",
            "confidence": 0.5,
            "risk_level": "MEDIUM",
            "summary": "No usable frames were extracted from the uploaded video.",
            "details": [],
            "artifacts_detected": [],
            "recommendation": "Try a longer or less corrupted video clip.",
            "frame_analysis": [],
        }

    model = build_reference_model("video", extract_video_feature_vector)
    frame_model = project_reference_model(model, int(frame_vectors[0].shape[0]))
    frame_images = extract_video_frames_b64(file_path, max_frames=None, indices=frame_indices)
    # Per-frame analysis
    frame_results = []
    for idx, frame_vec in enumerate(frame_vectors):
        frame_class = classify_with_reference_model(frame_vec, frame_model)
        frame_verdict = frame_class["verdict"]
        fake_prob = frame_class.get("fake_probability", 1.0 if frame_verdict == "FAKE" else 0.0)
        confidence = frame_class["confidence"]
        top_neighbor = frame_class.get("nearest_neighbors", [None])[:1]
        neighbor_text = "similarity pattern"
        if top_neighbor and top_neighbor[0]:
            neighbor_distance, neighbor_label, neighbor_name = top_neighbor[0]
            neighbor_text = f"closest match {neighbor_name} ({neighbor_label}, distance {neighbor_distance:.2f})"
        frame_results.append({
            "frame": idx + 1,
            "source_frame": int(frame_indices[idx]) + 1 if idx < len(frame_indices) else idx + 1,
            "label": frame_verdict,
            "fake_prob": round(fake_prob * 100, 2),
            "confidence": round(confidence * 100, 2),
            "thumbnail": frame_images[idx] if idx < len(frame_images) else None,
            "reason": (
                f"Marked {frame_verdict} because this frame is closest to the {frame_verdict.lower()} reference cluster; "
                f"{neighbor_text}."
            ),
        })

    frame_fake_probs = [float(frame["fake_prob"]) for frame in frame_results]
    frame_confidences = [max(float(frame["confidence"]), 1.0) for frame in frame_results]
    weighted_fake_prob = sum(p * w for p, w in zip(frame_fake_probs, frame_confidences)) / (sum(frame_confidences) or 1.0)
    median_fake_prob = float(statistics.median(frame_fake_probs))
    fake_vote_ratio = sum(1 for prob in frame_fake_probs if prob >= 50.0) / len(frame_fake_probs)

    real_distance = float(np.linalg.norm(feature_vector - model["real_centroid"]) / model["real_spread"])
    fake_distance = float(np.linalg.norm(feature_vector - model["fake_centroid"]) / model["fake_spread"])
    distance_fake_score = fake_distance / (real_distance + fake_distance + 1e-6)

    combined_fake_score = (
        (weighted_fake_prob / 100.0) * 0.42
        + (median_fake_prob / 100.0) * 0.18
        + fake_vote_ratio * 0.15
        + distance_fake_score * 0.25
    )

    # Be conservative: borderline clips are marked inconclusive instead of forcing a fake verdict.
    if combined_fake_score >= 0.58 and fake_vote_ratio >= 0.5:
        overall_verdict = "FAKE"
        overall_confidence = combined_fake_score
    elif combined_fake_score <= 0.42 and fake_vote_ratio <= 0.6:
        overall_verdict = "REAL"
        overall_confidence = 1.0 - combined_fake_score
    else:
        overall_verdict = "INCONCLUSIVE"
        overall_confidence = 0.5

    brightness_std = float(feature_vector[-5])
    sharpness_std = float(feature_vector[-4])
    motion_mean = float(feature_vector[-3])
    motion_std = float(feature_vector[-2])
    sampled_frames = int(feature_vector[-1])
    artifacts_detected = []
    if brightness_std > 20:
        artifacts_detected.append("brightness flicker")
    if sharpness_std > 120:
        artifacts_detected.append("sharpness instability")
    if motion_std > 18:
        artifacts_detected.append("temporal motion inconsistency")
    if overall_verdict == "FAKE":
        artifacts_detected.append("reference-matched temporal anomaly")

    if overall_verdict == "INCONCLUSIVE":
        summary = (
            f"Video analysis is inconclusive because the frame votes and temporal similarity are too close "
            f"to separate confidently."
        )
    else:
        summary = f"Video Verdict: {overall_verdict} (combined fake score: {combined_fake_score * 100:.2f}%)"
    return {
        "verdict": overall_verdict,
        "confidence": overall_confidence,
        "fake_probability": combined_fake_score,
        "risk_level": compute_risk_level(overall_verdict, overall_confidence),
        "summary": summary,
        "details": [
            {
                "category": "Reference Similarity",
                "finding": f"Frame-by-frame analysis performed.",
                "severity": "low" if overall_verdict == "REAL" else "high",
            },
            {
                "category": "Temporal Stability",
                "finding": f"Brightness variation {brightness_std:.2f}, sharpness variation {sharpness_std:.2f}, motion variation {motion_std:.2f}, sampled frames {sampled_frames}.",
                "severity": "medium" if artifacts_detected else "low",
            },
            {
                "category": "Dataset Calibration",
                "finding": f"Compared against {model['real_count']} real and {model['fake_count']} fake reference videos from the local dataset.",
                "severity": "low",
            },
        ],
        "artifacts_detected": artifacts_detected,
        "recommendation": "Use short clips with visible faces, stable framing, and low compression for stronger video matching against the local reference set.",
        "frame_analysis": frame_results,
    }


def extract_audio_features(audio_path: str) -> dict:
    """Extract audio signal features for deepfake detection."""
    try:
        import librosa

        y, sr = librosa.load(audio_path, sr=None, duration=30)
        duration = librosa.get_duration(y=y, sr=sr)
        rms = float(np.mean(librosa.feature.rms(y=y)))
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = float(np.mean(mfcc))
        mfcc_std = float(np.std(mfcc))
        spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        spectral_rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
        spectral_bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitch_values = pitches[magnitudes > np.median(magnitudes)]
        pitch_std = float(np.std(pitch_values)) if len(pitch_values) > 0 else 0.0

        return {
            "sample_rate": sr,
            "duration": round(duration, 2),
            "rms_energy": round(rms, 6),
            "zero_crossing_rate": round(zcr, 6),
            "mfcc_mean": round(mfcc_mean, 4),
            "mfcc_std": round(mfcc_std, 4),
            "spectral_centroid": round(spectral_centroid, 2),
            "spectral_rolloff": round(spectral_rolloff, 2),
            "spectral_bandwidth": round(spectral_bandwidth, 2),
            "pitch_std": round(pitch_std, 4),
        }
    except Exception as e:
        logger.error(f"Audio feature extraction failed: {e}")
        try:
            import soundfile as sf

            y, sr = sf.read(audio_path)
            if getattr(y, "ndim", 1) > 1:
                y = np.mean(y, axis=1)
            y = y.astype(np.float32)
            if len(y) == 0:
                raise ValueError("Empty audio signal")

            duration = len(y) / float(sr)
            rms = float(np.sqrt(np.mean(np.square(y))))
            zcr = float(np.mean(np.abs(np.diff(np.signbit(y)).astype(np.float32))))

            spectrum = np.abs(np.fft.rfft(y))
            freqs = np.fft.rfftfreq(len(y), d=1.0 / sr)
            spec_sum = float(np.sum(spectrum)) or 1.0
            spectral_centroid = float(np.sum(freqs * spectrum) / spec_sum)
            spectral_bandwidth = float(np.sqrt(np.sum(((freqs - spectral_centroid) ** 2) * spectrum) / spec_sum))
            cumulative = np.cumsum(spectrum)
            rolloff_index = int(np.searchsorted(cumulative, 0.85 * cumulative[-1]))
            spectral_rolloff = float(freqs[min(rolloff_index, len(freqs) - 1)])

            frame_size = min(2048, len(y))
            hop = max(frame_size // 2, 1)
            frame_means = []
            frame_stds = []
            for start in range(0, max(len(y) - frame_size + 1, 1), hop):
                frame = y[start : start + frame_size]
                if len(frame) < 8:
                    continue
                spectrum_frame = np.log1p(np.abs(np.fft.rfft(frame)))
                frame_means.append(float(np.mean(spectrum_frame)))
                frame_stds.append(float(np.std(spectrum_frame)))

            mfcc_mean = float(np.mean(frame_means)) if frame_means else 0.0
            mfcc_std = float(np.mean(frame_stds)) if frame_stds else 0.0

            zero_crossings = np.where(np.diff(np.signbit(y)))[0]
            if len(zero_crossings) > 1:
                crossing_intervals = np.diff(zero_crossings) / float(sr)
                estimated_pitch = 1.0 / np.clip(crossing_intervals * 2, 1e-6, None)
                pitch_std = float(np.std(estimated_pitch))
            else:
                pitch_std = 0.0

            return {
                "sample_rate": int(sr),
                "duration": round(duration, 2),
                "rms_energy": round(rms, 6),
                "zero_crossing_rate": round(zcr, 6),
                "mfcc_mean": round(mfcc_mean, 4),
                "mfcc_std": round(mfcc_std, 4),
                "spectral_centroid": round(spectral_centroid, 2),
                "spectral_rolloff": round(spectral_rolloff, 2),
                "spectral_bandwidth": round(spectral_bandwidth, 2),
                "pitch_std": round(pitch_std, 4),
            }
        except Exception as fallback_error:
            logger.error(f"Fallback audio feature extraction failed: {fallback_error}")
            try:
                import wave

                with wave.open(audio_path, "rb") as wav_file:
                    sr = wav_file.getframerate()
                    n_channels = wav_file.getnchannels()
                    sample_width = wav_file.getsampwidth()
                    n_frames = wav_file.getnframes()
                    raw = wav_file.readframes(n_frames)

                dtype_map = {1: np.int8, 2: np.int16, 4: np.int32}
                dtype = dtype_map.get(sample_width)
                if dtype is None:
                    raise ValueError(f"Unsupported sample width: {sample_width}")

                y = np.frombuffer(raw, dtype=dtype).astype(np.float32)
                if n_channels > 1:
                    y = y.reshape(-1, n_channels).mean(axis=1)
                max_val = float(np.iinfo(dtype).max) or 1.0
                y = y / max_val
                if len(y) == 0:
                    raise ValueError("Empty audio signal")

                duration = len(y) / float(sr)
                rms = float(np.sqrt(np.mean(np.square(y))))
                zcr = float(np.mean(np.abs(np.diff(np.signbit(y)).astype(np.float32))))

                spectrum = np.abs(np.fft.rfft(y))
                freqs = np.fft.rfftfreq(len(y), d=1.0 / sr)
                spec_sum = float(np.sum(spectrum)) or 1.0
                spectral_centroid = float(np.sum(freqs * spectrum) / spec_sum)
                spectral_bandwidth = float(np.sqrt(np.sum(((freqs - spectral_centroid) ** 2) * spectrum) / spec_sum))
                cumulative = np.cumsum(spectrum)
                rolloff_index = int(np.searchsorted(cumulative, 0.85 * cumulative[-1]))
                spectral_rolloff = float(freqs[min(rolloff_index, len(freqs) - 1)])

                window = min(2048, len(y))
                if window < 8:
                    window = len(y)
                step = max(window // 2, 1)
                frame_energy = []
                frame_spread = []
                for start in range(0, max(len(y) - window + 1, 1), step):
                    frame = y[start : start + window]
                    if len(frame) < 8:
                        continue
                    spectrum_frame = np.log1p(np.abs(np.fft.rfft(frame)))
                    frame_energy.append(float(np.mean(spectrum_frame)))
                    frame_spread.append(float(np.std(spectrum_frame)))

                mfcc_mean = float(np.mean(frame_energy)) if frame_energy else 0.0
                mfcc_std = float(np.mean(frame_spread)) if frame_spread else 0.0

                zero_crossings = np.where(np.diff(np.signbit(y)))[0]
                if len(zero_crossings) > 1:
                    crossing_intervals = np.diff(zero_crossings) / float(sr)
                    estimated_pitch = 1.0 / np.clip(crossing_intervals * 2, 1e-6, None)
                    pitch_std = float(np.std(estimated_pitch))
                else:
                    pitch_std = 0.0

                return {
                    "sample_rate": int(sr),
                    "duration": round(duration, 2),
                    "rms_energy": round(rms, 6),
                    "zero_crossing_rate": round(zcr, 6),
                    "mfcc_mean": round(mfcc_mean, 4),
                    "mfcc_std": round(mfcc_std, 4),
                    "spectral_centroid": round(spectral_centroid, 2),
                    "spectral_rolloff": round(spectral_rolloff, 2),
                    "spectral_bandwidth": round(spectral_bandwidth, 2),
                    "pitch_std": round(pitch_std, 4),
                }
            except Exception as wave_error:
                logger.error(f"WAV audio feature extraction failed: {wave_error}")
                try:
                    from scipy.io import wavfile

                    sr, y = wavfile.read(audio_path)
                    y = y.astype(np.float32)
                    if getattr(y, "ndim", 1) > 1:
                        y = np.mean(y, axis=1)
                    if np.max(np.abs(y)) > 0:
                        y = y / np.max(np.abs(y))
                    if len(y) == 0:
                        raise ValueError("Empty audio signal")

                    duration = len(y) / float(sr)
                    rms = float(np.sqrt(np.mean(np.square(y))))
                    zcr = float(np.mean(np.abs(np.diff(np.signbit(y)).astype(np.float32))))
                    spectrum = np.abs(np.fft.rfft(y))
                    freqs = np.fft.rfftfreq(len(y), d=1.0 / sr)
                    spec_sum = float(np.sum(spectrum)) or 1.0
                    spectral_centroid = float(np.sum(freqs * spectrum) / spec_sum)
                    spectral_bandwidth = float(np.sqrt(np.sum(((freqs - spectral_centroid) ** 2) * spectrum) / spec_sum))
                    cumulative = np.cumsum(spectrum)
                    rolloff_index = int(np.searchsorted(cumulative, 0.85 * cumulative[-1]))
                    spectral_rolloff = float(freqs[min(rolloff_index, len(freqs) - 1)])

                    window = min(2048, len(y))
                    step = max(window // 2, 1)
                    frame_energy = []
                    frame_spread = []
                    for start in range(0, max(len(y) - window + 1, 1), step):
                        frame = y[start : start + window]
                        if len(frame) < 8:
                            continue
                        spectrum_frame = np.log1p(np.abs(np.fft.rfft(frame)))
                        frame_energy.append(float(np.mean(spectrum_frame)))
                        frame_spread.append(float(np.std(spectrum_frame)))

                    mfcc_mean = float(np.mean(frame_energy)) if frame_energy else 0.0
                    mfcc_std = float(np.mean(frame_spread)) if frame_spread else 0.0
                    zero_crossings = np.where(np.diff(np.signbit(y)))[0]
                    if len(zero_crossings) > 1:
                        crossing_intervals = np.diff(zero_crossings) / float(sr)
                        estimated_pitch = 1.0 / np.clip(crossing_intervals * 2, 1e-6, None)
                        pitch_std = float(np.std(estimated_pitch))
                    else:
                        pitch_std = 0.0

                    return {
                        "sample_rate": int(sr),
                        "duration": round(duration, 2),
                        "rms_energy": round(rms, 6),
                        "zero_crossing_rate": round(zcr, 6),
                        "mfcc_mean": round(mfcc_mean, 4),
                        "mfcc_std": round(mfcc_std, 4),
                        "spectral_centroid": round(spectral_centroid, 2),
                        "spectral_rolloff": round(spectral_rolloff, 2),
                        "spectral_bandwidth": round(spectral_bandwidth, 2),
                        "pitch_std": round(pitch_std, 4),
                    }
                except Exception as scipy_error:
                    logger.error(f"Scipy audio feature extraction failed: {scipy_error}")
                    return {
                        "sample_rate": "unknown",
                        "duration": "unknown",
                        "rms_energy": "unknown",
                        "zero_crossing_rate": "unknown",
                        "mfcc_mean": "unknown",
                        "mfcc_std": "unknown",
                        "spectral_centroid": "unknown",
                        "spectral_rolloff": "unknown",
                        "spectral_bandwidth": "unknown",
                        "pitch_std": "unknown",
                    }


def extract_video_frames_b64(video_path: str, max_frames: int | None = 4, indices: list[int] | None = None) -> list:
    """Extract frames from video and return as base64 strings."""
    try:
        import cv2

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return []

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            cap.release()
            return []

        if indices is not None:
            sample_indices = sorted({int(index) for index in indices if 0 <= int(index) < total_frames})
        else:
            sample_count = total_frames if max_frames is None else min(max_frames, total_frames)
            sample_indices = sorted({int(i * max(total_frames - 1, 0) / max(sample_count - 1, 1)) for i in range(sample_count)})
        frames_b64 = []
        for frame_count in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_count)
            ret, frame = cap.read()
            if not ret:
                continue
            _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            b64 = base64.b64encode(buffer).decode("utf-8")
            frames_b64.append(b64)
        cap.release()
        return frames_b64
    except Exception as e:
        logger.error(f"Video frame extraction failed: {e}")
        return []


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "DeepFake Detector",
        "database": "connected" if db_available else "fallback-memory",
    }


@app.post("/api/analyze/image")
async def analyze_image(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = analyze_image_local(tmp_path)
        file_size = len(content)
        scan_record = {
            "scan_id": uuid.uuid4().hex,
            "media_type": "image",
            "filename": file.filename,
            "file_size": file_size,
            "verdict": result.get("verdict", "INCONCLUSIVE"),
            "confidence": result.get("confidence", 0.5),
            "risk_level": result.get("risk_level", "MEDIUM"),
            "summary": result.get("summary", ""),
            "details": result.get("details", []),
            "artifacts_detected": result.get("artifacts_detected", []),
            "recommendation": result.get("recommendation", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        save_scan(scan_record)
        scan_record.pop("_id", None)
        return scan_record
    finally:
        os.unlink(tmp_path)


@app.post("/api/analyze/audio")
async def analyze_audio(file: UploadFile = File(...)):
    allowed = ["audio/", "video/"]
    if not file.content_type or not any(file.content_type.startswith(a) for a in allowed):
        raise HTTPException(status_code=400, detail="File must be an audio file")

    suffix = ".wav"
    if file.filename:
        ext = os.path.splitext(file.filename)[1]
        if ext:
            suffix = ext

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        audio_features = extract_audio_features(tmp_path)
        result = analyze_audio_local(tmp_path)
        file_size = len(content)
        scan_record = {
            "scan_id": uuid.uuid4().hex,
            "media_type": "audio",
            "filename": file.filename,
            "file_size": file_size,
            "verdict": result.get("verdict", "INCONCLUSIVE"),
            "confidence": result.get("confidence", 0.5),
            "risk_level": result.get("risk_level", "MEDIUM"),
            "summary": result.get("summary", ""),
            "details": result.get("details", []),
            "artifacts_detected": result.get("artifacts_detected", []),
            "recommendation": result.get("recommendation", ""),
            "audio_features": audio_features,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        save_scan(scan_record)
        scan_record.pop("_id", None)
        return scan_record
    finally:
        os.unlink(tmp_path)


@app.post("/api/analyze/video")
async def analyze_video(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    suffix = ".mp4"
    if file.filename:
        ext = os.path.splitext(file.filename)[1]
        if ext:
            suffix = ext

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = analyze_video_local(tmp_path)
        file_size = len(content)
        scan_record = {
            "scan_id": uuid.uuid4().hex,
            "media_type": "video",
            "filename": file.filename,
            "file_size": file_size,
            "verdict": result.get("verdict", "INCONCLUSIVE"),
            "confidence": result.get("confidence", 0.5),
            "risk_level": result.get("risk_level", "MEDIUM"),
            "summary": result.get("summary", ""),
            "details": result.get("details", []),
            "artifacts_detected": result.get("artifacts_detected", []),
            "recommendation": result.get("recommendation", ""),
            "frame_analysis": result.get("frame_analysis", []),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        save_scan(scan_record)
        scan_record.pop("_id", None)
        return scan_record
    finally:
        os.unlink(tmp_path)


@app.get("/api/scans")
async def get_scans(limit: int = 20, skip: int = 0):
    return list_scans(limit=limit, skip=skip)


@app.get("/api/scans/{scan_id}")
async def get_scan(scan_id: str):
    scan = get_scan_record(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@app.get("/api/analytics")
async def get_analytics():
    return build_analytics()


@app.get("/api/performance")
async def get_performance():
    return build_performance_payload()
