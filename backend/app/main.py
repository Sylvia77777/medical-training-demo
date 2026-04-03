import asyncio
import os
import sqlite3
import uuid
from contextlib import closing
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import AsyncOpenAI


class PatientRequest(BaseModel):
    session_id: str
    question: str


class SessionResponse(BaseModel):
    session_id: str


class MessageItem(BaseModel):
    role: str
    content: str
    created_at: str


class HistoryResponse(BaseModel):
    session_id: str
    messages: list[MessageItem]


DB_PATH = Path(__file__).resolve().parents[1] / "data.db"
AI_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")
AI_BASE_URL = os.getenv("AI_BASE_URL")
AI_API_KEY = os.getenv("AI_API_KEY")
SYSTEM_PROMPT = (
    "你是临床问诊训练系统中的虚拟患者。"
    "病例设定：25岁男性，主诉腹痛。"
    "请始终遵循“不问不答，问对才答”，不要主动补充未被问到的关键病史。"
    "回复口语化、简洁，语气略焦虑但配合。"
)


def init_db() -> None:
    with closing(sqlite3.connect(DB_PATH)) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()


def list_session_messages(session_id: str) -> list[dict[str, str]]:
    with closing(sqlite3.connect(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT role, content, created_at
            FROM chat_messages
            WHERE session_id = ?
            ORDER BY created_at ASC, id ASC
            """,
            (session_id,),
        ).fetchall()
    return [
        {"role": row["role"], "content": row["content"], "created_at": row["created_at"]}
        for row in rows
    ]


def save_message(session_id: str, role: str, content: str) -> None:
    with closing(sqlite3.connect(DB_PATH)) as conn:
        conn.execute(
            """
            INSERT INTO chat_messages (id, session_id, role, content)
            VALUES (?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), session_id, role, content),
        )
        conn.commit()


def session_exists(session_id: str) -> bool:
    with closing(sqlite3.connect(DB_PATH)) as conn:
        row = conn.execute(
            "SELECT 1 FROM chat_messages WHERE session_id = ? LIMIT 1",
            (session_id,),
        ).fetchone()
    return row is not None


def build_mock_answer(question: str) -> str:
    if any(token in question for token in ["转移", "右下腹", "部位"]):
        return "一开始是肚脐周围闷痛，后面慢慢跑到右下腹了，走路和咳嗽会更痛。"
    if any(token in question for token in ["恶心", "呕吐", "发热"]):
        return "有点恶心，昨晚吐过一次，体温好像有点高，但我没认真量。"
    if any(token in question for token in ["过敏", "药物"]):
        return "我没有印象有药物过敏，今天只吃过一片止痛药。"
    return "我现在主要就是肚子疼，越来越不舒服，想尽快查清楚是什么问题。"


async def stream_text(text: str) -> AsyncGenerator[str, None]:
    for ch in text:
        yield ch
        await asyncio.sleep(0.02)


def build_patient_messages(session_id: str, current_question: str) -> list[dict[str, str]]:
    history = list_session_messages(session_id)
    messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for item in history[-20:]:
        role = item["role"]
        if role in ("doctor", "patient"):
            mapped_role = "user" if role == "doctor" else "assistant"
            messages.append({"role": mapped_role, "content": item["content"]})
    messages.append({"role": "user", "content": current_question})
    return messages


async def stream_from_llm(session_id: str, question: str) -> AsyncGenerator[str, None]:
    if not AI_API_KEY:
        async for chunk in stream_text(build_mock_answer(question)):
            yield chunk
        return

    client = AsyncOpenAI(api_key=AI_API_KEY, base_url=AI_BASE_URL)
    completion = await client.chat.completions.create(
        model=AI_MODEL,
        messages=build_patient_messages(session_id, question),
        temperature=0.6,
        stream=True,
    )
    async for event in completion:
        delta = event.choices[0].delta.content if event.choices else None
        if delta:
            yield delta


app = FastAPI(title="medical-training-demo-backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "model": AI_MODEL,
        "llm_enabled": "true" if AI_API_KEY else "false",
    }


@app.on_event("startup")
async def startup() -> None:
    init_db()


@app.post("/api/session", response_model=SessionResponse)
async def create_session() -> SessionResponse:
    return SessionResponse(session_id=str(uuid.uuid4()))


@app.get("/api/session/{session_id}/messages", response_model=HistoryResponse)
async def get_session_messages(session_id: str) -> HistoryResponse:
    messages = [
        MessageItem(**item)
        for item in list_session_messages(session_id)
    ]
    return HistoryResponse(session_id=session_id, messages=messages)


@app.post("/api/patient/stream")
async def patient_stream(payload: PatientRequest) -> StreamingResponse:
    question = payload.question.strip()
    session_id = payload.session_id.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    if not session_exists(session_id):
        # First message in a new session is valid.
        pass

    save_message(session_id, "doctor", question)

    async def response_stream() -> AsyncGenerator[str, None]:
        full_answer = ""
        async for chunk in stream_from_llm(session_id=session_id, question=question):
            full_answer += chunk
            yield chunk
        save_message(session_id, "patient", full_answer)

    return StreamingResponse(response_stream(), media_type="text/plain; charset=utf-8")
