import base64
import re
import threading
import time
import uuid
from dataclasses import dataclass

import requests
from Crypto.Cipher import AES


AUTH_BASE = "https://open.lnnu.edu.cn"
JWGL_BASE = "https://jwgl2022.lnnu.edu.cn"
SERVICE_URL = "http://jwgl2022.lnnu.edu.cn/eams/loginExt.action"
QR_LOGIN_PARAMS = {"service": SERVICE_URL, "login_type": "wechat_work_oauth"}
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0"
)
SESSION_TTL_SECONDS = 180


class SchoolAuthError(RuntimeError):
    pass


class QrPending(SchoolAuthError):
    pass


class QrExpired(SchoolAuthError):
    pass


@dataclass
class SchoolIdentity:
    student_id: str


@dataclass
class QrSession:
    http: requests.Session
    login_url: str
    short_id: str
    image_data: str
    created_at: float


_lock = threading.Lock()
_sessions: dict[str, QrSession] = {}


def encrypted_password(password: str, token: str) -> str:
    key = token[:16].encode("utf-8")
    raw = password.encode("utf-8")
    raw += b"\x00" * ((-len(raw)) % AES.block_size)
    cipher = AES.new(key, AES.MODE_CBC, iv=key)
    return base64.b64encode(cipher.encrypt(raw)).decode("ascii")


def _headers(accept: str, referer: str | None = None) -> dict[str, str]:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": accept,
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }
    if referer:
        headers["Referer"] = referer
    return headers


def _navigation_headers(referer: str | None = None) -> dict[str, str]:
    return _headers("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", referer)


def _json_headers(referer: str) -> dict[str, str]:
    return _headers("application/json, text/javascript, */*; q=0.01", referer)


def _cleanup(now: float | None = None) -> None:
    now = now or time.monotonic()
    expired = [key for key, item in _sessions.items() if now - item.created_at > SESSION_TTL_SECONDS]
    for key in expired:
        _sessions.pop(key, None)


def _student_id(response: requests.Response) -> str:
    header = response.headers.get("X-Wrd-User")
    if header:
        return header.strip()
    match = re.search(r"(?:user\.name=|['\"]username['\"]\s*:\s*['\"])(\d{8,})", response.text)
    return match.group(1) if match else ""


def start_qr_registration() -> tuple[str, str, int]:
    http = requests.Session()
    login_page = http.get(
        f"{AUTH_BASE}/auth/cas/login",
        params=QR_LOGIN_PARAMS,
        headers=_navigation_headers(f"{JWGL_BASE}/"),
        timeout=20,
    )
    login_page.raise_for_status()

    response = http.post(
        f"{AUTH_BASE}/auth/base/get_url_qrcode",
        params={"login_type": "wechat_work_oauth", "extra": "qrCode", "format": "image_data"},
        headers=_json_headers(login_page.url),
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    data = payload.get("data") or {}
    short_id = data.get("short_id")
    image_data = data.get("image_data", "")
    if payload.get("code") != 1 or not short_id or "," not in image_data:
        raise SchoolAuthError("无法获取学校扫码二维码")

    session_id = uuid.uuid4().hex
    with _lock:
        # ponytail: in-memory QR sessions; use DB/Redis before running multiple Gunicorn workers.
        _cleanup()
        _sessions[session_id] = QrSession(http, login_page.url, short_id, image_data, time.monotonic())
    return session_id, image_data, SESSION_TTL_SECONDS


def poll_qr_registration(session_id: str) -> SchoolIdentity:
    with _lock:
        _cleanup()
        qr = _sessions.get(session_id)
    if qr is None:
        raise QrExpired("二维码已过期，请重新获取")

    response = qr.http.post(
        f"{AUTH_BASE}/index.php/auth/base/check_comet_login",
        data={"extra": "qrCode", "short_id": qr.short_id},
        headers=_json_headers(qr.login_url),
        timeout=20,
    )
    response.raise_for_status()
    result = response.json()
    if result.get("code") == "expired":
        with _lock:
            _sessions.pop(session_id, None)
        raise QrExpired("二维码已过期，请重新获取")
    if not result.get("data"):
        raise QrPending("等待扫码确认")

    response = qr.http.post(
        f"{AUTH_BASE}/auth/cas/login",
        params={"service": SERVICE_URL},
        headers=_navigation_headers(qr.login_url),
        timeout=20,
    )
    response.raise_for_status()
    student_id = _student_id(response)
    if "/eams/homeExt.action" not in response.url or not student_id:
        raise SchoolAuthError("学校认证成功，但未获取到学号")

    with _lock:
        _sessions.pop(session_id, None)
    return SchoolIdentity(student_id=student_id)


def self_check() -> None:
    response = requests.Response()
    response.status_code = 200
    response._content = b""
    response.headers["X-Wrd-User"] = "20240001"
    identity = SchoolIdentity(student_id=_student_id(response))
    assert identity.student_id == "20240001"
    assert encrypted_password("password", "1234567890abcdef")
