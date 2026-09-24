import json
import re

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .school_auth import QrExpired, QrPending, SchoolAuthError, poll_qr_registration, start_qr_registration


def json_body(request) -> dict:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return {}


def serialize_user(user) -> dict | None:
    if not user.is_authenticated:
        return None
    return {
        "id": user.id,
        "username": user.username,
        "student_id": user.student_id or "",
    }


def _create_school_user(body: dict):
    username = body.get("username", "").strip()
    password = body.get("password", "")
    school = body.get("school_identity") or {}
    student_id = school.get("student_id", "")
    User = get_user_model()

    if not username or not password:
        raise ValueError("用户名和密码不能为空")
    if not 3 <= len(username) <= 32:
        raise ValueError("用户名长度必须为 3 至 32 个字符")
    if len(password) > 128:
        raise ValueError("密码不能超过 128 个字符")
    if not student_id:
        raise ValueError("请先完成学校扫码认证")
    if not re.fullmatch(r"\d{8,32}", student_id):
        raise ValueError("学校认证返回了无效学号")
    if User.objects.filter(username=username).exists():
        raise ValueError("用户名已存在")
    if User.objects.filter(student_id=student_id).exists():
        raise ValueError("该学号已注册，请直接登录")

    user = User(username=username, student_id=student_id)
    try:
        validate_password(password, user)
    except ValidationError as error:
        raise ValueError("；".join(error.messages)) from error
    return User.objects.create_user(username=username, password=password, student_id=student_id)


@require_GET
@ensure_csrf_cookie
def me(request):
    return JsonResponse({"user": serialize_user(request.user)})


@require_POST
def register(request):
    return JsonResponse({"error": "请使用学校扫码完成注册"}, status=410)


@require_POST
def school_register_start(request):
    try:
        session_id, qr_image_data, expires_in = start_qr_registration()
    except Exception:
        return JsonResponse({"error": "学校二维码获取失败，请稍后重试"}, status=502)
    return JsonResponse(
        {
            "session_id": session_id,
            "qr_image_data": qr_image_data,
            "expires_in": expires_in,
        }
    )


@require_GET
def school_register_status(request, session_id: str):
    try:
        identity = poll_qr_registration(session_id)
    except QrPending:
        return JsonResponse({"status": "pending"})
    except QrExpired as error:
        return JsonResponse({"status": "expired", "error": str(error)}, status=410)
    except SchoolAuthError as error:
        return JsonResponse({"status": "error", "error": str(error)}, status=400)
    except Exception:
        return JsonResponse({"status": "error", "error": "学校认证状态检查失败"}, status=502)

    school_identity = {"student_id": identity.student_id}
    user = get_user_model().objects.filter(student_id=identity.student_id).first()
    if user:
        if not user.is_active:
            return JsonResponse({"status": "error", "error": "账号已被禁用"}, status=403)
        request.session.pop("school_registration_identity", None)
        login(request, user)
        return JsonResponse({"status": "authenticated", "user": serialize_user(user)})

    request.session["school_registration_identity"] = school_identity
    return JsonResponse({"status": "verified", "school_identity": school_identity})


@require_POST
def school_register_complete(request):
    body = json_body(request)
    body["school_identity"] = request.session.get("school_registration_identity")
    try:
        user = _create_school_user(body)
    except ValueError as error:
        return JsonResponse({"error": str(error)}, status=400)

    request.session.pop("school_registration_identity", None)
    login(request, user)
    return JsonResponse({"user": serialize_user(user)}, status=201)


@require_POST
def login_view(request):
    body = json_body(request)
    username = body.get("username", "").strip()
    password = body.get("password", "")
    if len(username) > 32 or len(password) > 128:
        return JsonResponse({"error": "用户名或密码错误"}, status=400)
    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"error": "用户名或密码错误"}, status=400)

    login(request, user)
    return JsonResponse({"user": serialize_user(user)})


@require_POST
def logout_view(request):
    logout(request)
    return JsonResponse({"ok": True})
