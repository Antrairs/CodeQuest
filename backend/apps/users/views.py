import json

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST


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
    return {"id": user.id, "username": user.username}


@require_GET
@ensure_csrf_cookie
def me(request):
    return JsonResponse({"user": serialize_user(request.user)})


@require_POST
def register(request):
    body = json_body(request)
    username = body.get("username", "").strip()
    password = body.get("password", "")

    if not username or not password:
        return JsonResponse({"error": "用户名和密码不能为空"}, status=400)
    if len(password) < 6:
        return JsonResponse({"error": "密码至少需要 6 位"}, status=400)
    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "用户名已存在"}, status=400)

    user = User.objects.create_user(username=username, password=password)
    login(request, user)
    return JsonResponse({"user": serialize_user(user)}, status=201)


@require_POST
def login_view(request):
    body = json_body(request)
    username = body.get("username", "").strip()
    password = body.get("password", "")
    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"error": "用户名或密码错误"}, status=400)

    login(request, user)
    return JsonResponse({"user": serialize_user(user)})


@require_POST
def logout_view(request):
    logout(request)
    return JsonResponse({"ok": True})

