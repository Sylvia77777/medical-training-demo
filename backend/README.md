# Backend Quick Start

## 1) Create and activate virtualenv (recommended)

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

## 2) Install dependencies

```powershell
pip install -r requirements.txt
```

## 3) Configure env vars

Copy `.env.example` and set values:

```powershell
copy .env.example .env
```

- `AI_API_KEY`: required for real LLM
- `AI_MODEL`: optional, default is `gpt-4o-mini`
- `AI_BASE_URL`: optional, set for DeepSeek/OpenAI-compatible providers

If no `AI_API_KEY` is set, backend falls back to mock patient responses.

## 4) Run dev server

```powershell
uvicorn app.main:app --reload --port 8000
```

## 5) Endpoints

- `GET /api/health`
- `POST /api/session`
- `GET /api/session/{session_id}/messages`
- `POST /api/patient/stream` with body:

```json
{ "session_id": "uuid", "question": "医生提问内容" }
```
