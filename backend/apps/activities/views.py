import json
from functools import wraps

from django.core.paginator import Paginator
from django.db.models import Count, IntegerField, OuterRef, Prefetch, Subquery
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST

from apps.submissions.models import Submission

from .models import Activity, ActivityCheckinClaim, ActivityProblem
from .services import activity_progress, can_claim, claim_checkin


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


def serialize_activity(activity: Activity, user, include_problems=False, include_code=False, progress=None) -> dict:
    progress = progress or activity_progress(activity, user)
    problem_count = getattr(activity, "problem_count", None)
    if problem_count is None:
        problem_count = activity.problems.count()
    data = {
        "id": activity.id,
        "name": activity.name,
        "description": activity.description,
        "start_at": activity.start_at.isoformat(),
        "end_at": activity.end_at.isoformat(),
        "required_problem_count": activity.required_problem_count,
        "status": activity.status,
        "status_label": activity.get_status_display(),
        "problem_count": problem_count,
        "progress": {
            "completed_count": progress.completed_count,
            "required_count": progress.required_count,
            "is_completed": progress.is_completed,
            "can_claim": can_claim(activity, user, progress) and progress.claim is None,
            "has_claimed": progress.claim is not None,
            "claimed_at": progress.claim.claimed_at.isoformat() if progress.claim else None,
            "view_count": progress.claim.view_count if progress.claim else 0,
        },
    }
    if include_problems:
        data["problems"] = [
            serialize_problem(link.problem, progress.passed_ids)
            for link in activity.activity_problems.all()
        ]
    if include_code and progress.claim:
        data["checkin_code"] = activity.checkin_code
        data["checkin_qr_image_url"] = activity.checkin_qr_image.url if activity.checkin_qr_image else ""
    return data


@require_GET
def activity_list(request):
    problem_counts = (
        ActivityProblem.objects.filter(activity_id=OuterRef("pk"))
        .order_by()
        .values("activity_id")
        .annotate(total=Count("pk"))
        .values("total")
    )
    activities = Activity.objects.filter(status=Activity.Status.PUBLISHED).annotate(
        problem_count=Coalesce(Subquery(problem_counts, output_field=IntegerField()), 0)
    ).order_by("-start_at", "-created_at")
    if request.user.is_authenticated:
        passed_counts = (
            Submission.objects.filter(
                user=request.user,
                problem__activity_links__activity_id=OuterRef("pk"),
                is_passed=True,
                created_at__gte=OuterRef("start_at"),
                created_at__lte=OuterRef("end_at"),
            )
            .order_by()
            .values("problem__activity_links__activity_id")
            .annotate(total=Count("problem_id", distinct=True))
            .values("total")
        )
        activities = activities.annotate(
            user_completed_count=Coalesce(Subquery(passed_counts, output_field=IntegerField()), 0)
        ).prefetch_related(
            Prefetch(
                "checkin_claims",
                queryset=ActivityCheckinClaim.objects.filter(user=request.user),
                to_attr="user_claims",
            )
        )

    page = Paginator(activities, 20).get_page(request.GET.get("page"))
    return JsonResponse(
        {
            "activities": [
                serialize_activity(activity, request.user)
                for activity in page
            ],
            "pagination": {
                "page": page.number,
                "pages": page.paginator.num_pages,
                "count": page.paginator.count,
                "has_previous": page.has_previous(),
                "has_next": page.has_next(),
            },
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
    activity = get_object_or_404(
        Activity.objects.prefetch_related("activity_problems__problem__category"),
        id=activity_id,
        status=Activity.Status.PUBLISHED,
    )
    progress = activity_progress(activity, request.user)
    if not can_claim(activity, request.user, progress):
        return JsonResponse({"error": "活动任务尚未完成，暂不能领取签到码。"}, status=400)
    progress.claim = claim_checkin(activity, request.user)
    return JsonResponse({"activity": serialize_activity(activity, request.user, True, True, progress)})
