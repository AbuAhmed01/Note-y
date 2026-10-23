import os
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

app = FastAPI(title="Note-y local transcription")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:1420", "tauri://localhost"],
    allow_methods=["POST"],
    allow_headers=["*"],
)
model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
):
    suffix = Path(file.filename or "recording.webm").suffix or ".webm"
    with NamedTemporaryFile(suffix=suffix, delete=False) as temporary:
        temporary.write(await file.read())
        path = temporary.name
    try:
        segments, info = model.transcribe(path, language=None if language in (None, "", "auto") else language, vad_filter=True)
        items = [{"start": segment.start, "end": segment.end, "text": segment.text.strip(), "speaker": "Speaker 1"} for segment in segments]
        return {"text": " ".join(item["text"] for item in items), "language": info.language, "segments": items}
    finally:
        Path(path).unlink(missing_ok=True)
