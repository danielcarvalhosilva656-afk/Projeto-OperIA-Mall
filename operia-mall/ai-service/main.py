import base64, os, tempfile
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from rules import analyze

app = FastAPI(title="OperIA Mall - Servico de IA", version="1.0.0")


class AnalyzeIn(BaseModel):
    description: str = Field(min_length=1, max_length=4000)
    category: str | None = None
    location_text: str = ""
    recurrence_count: int = 0
    waiting_minutes: int = 0


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
def analyze_endpoint(body: AnalyzeIn):
    return analyze(body.description, body.category, body.location_text,
                   body.recurrence_count, body.waiting_minutes)


class TranscribeIn(BaseModel):
    audio_b64: str
    mime: str = "audio/mp4"


_model = None


@app.post("/transcribe")
def transcribe(body: TranscribeIn):
    """Transcricao de audio (pt-BR) com faster-whisper. Instale com WITH_ASR=true no build."""
    global _model
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise HTTPException(status_code=501, detail="ASR nao instalado (build com WITH_ASR=true)")
    if _model is None:
        _model = WhisperModel(os.getenv("WHISPER_MODEL", "base"), device="cpu", compute_type="int8")
    ext = {"audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/webm": ".webm", "audio/aac": ".aac"}.get(body.mime, ".m4a")
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
        f.write(base64.b64decode(body.audio_b64))
        path = f.name
    try:
        segments, _ = _model.transcribe(path, language="pt", vad_filter=True)
        return {"text": " ".join(s.text.strip() for s in segments).strip()}
    finally:
        os.unlink(path)
