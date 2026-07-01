import json
from functools import wraps

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST

from .models import Activity
from .services import activity_progress, can_claim, claim_checkin, passed_problem_ids


def require_auth(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "请先登录"}, status=401)
        return view_func(request, *args, **kwargs)

    return wrapper


def serialize_problem(problem, passed_ids: set[int]) -> dict:
    return {
        "id": problem.id,
        "title": problem.title,
        "description": problem.description,
        "difficulty": problem.difficulty,
        "difficulty_label": problem.get_difficulty_display(),
        "category": problem.category.name if problem.category else "",
        "is_passed_in_activity": problem.id in passed_ids,
    }


def serialize_activity(activity: Activity, user, include_problems=False, include_code=False) -> dict:
    progress = activity_progress(activity, user)
    data = {
        "id": activity.id,
        "name": activity.name,
        "description": activity.description,
        "start_at": activity.start_at.isoformat(),
        "end_at": activity.end_at.isoformat(),
        "required_problem_count": activity.required_problem_count,
        "status": activity.status,
        "status_label": activity.get_status_display(),
        "problem_count": activity.problems.count(),
        "progress": {
            "completed_count": progress.completed_count,
            "required_count": progress.required_count,
            "is_completed": progress.is_completed,
            "can_claim": can_claim(activity, user) and progress.claim is None,
            "has_claimed": progress.claim is not None,
            "claimed_at": progress.claim.claimed_at.isoformat() if progress.claim else None,
            "view_count": progress.claim.view_count if progress.claim else 0,
        },
    }
    if include_problems:
        passed_ids = passed_problem_ids(activity, user)
        data["problems"] = [
            serialize_problem(link.problem, passed_ids)
            for link in activity.activity_problems.select_related("problem", "problem__category")
        ]
    if include_code and progress.claim:
        data["checkin_code"] = activity.checkin_code
        data["checkin_qr_image_url"] = activity.checkin_qr_image.url if activity.checkin_qr_image else ""
    return data


@require_GET
def activity_list(request):
    activities = Activity.objects.filter(status=Activity.Status.PUBLISHED).prefetch_related("problems")
    return JsonResponse(
        {
            "activities": [
                serialize_activity(activity, request.user)
                for activity in activities
            ]
        }
    )


@require_GET
def activity_detail(request, activity_id):
    activity = get_object_or_404(
        Activity.objects.prefetch_related("activity_problems__problem__category"),
        id=activity_id,
        status=Activity.Status.PUBLISHED,
    )
    include_code = bool(request.user.is_authenticated)
    return JsonResponse({"activity": serialize_activity(activity, request.user, True, include_code)})


@require_POST
@require_auth
def claim_activity(request, activity_id):
    activity = get_object_or_404(Activity, id=activity_id, status=Activity.Status.PUBLISHED)
    if not can_claim(activity, request.user):
        return JsonResponse({"error": "活动任务尚未完成，暂不能领取签到码。"}, status=400)
    claim_checkin(activity, request.user)
    return JsonResponse({"activity": serialize_activity(activity, request.user, True, True)})
