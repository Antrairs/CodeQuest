import json
from functools import wraps

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from apps.problems.models import Problem

from .models import Submission, WrongProblem


def json_body(request) -> dict:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return {}


def require_auth(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "请先登录"}, status=401)
        return view_func(request, *args, **kwargs)

    return wrapper


def serialize_submission(submission: Submission) -> dict:
    return {
        "id": submission.id,
        "problem": {
            "id": submission.problem_id,
            "title": submission.problem.title,
            "category": submission.problem.category.name if submission.problem.category else "",
            "difficulty": submission.problem.difficulty,
            "difficulty_label": submission.problem.get_difficulty_display(),
        },
        "is_passed": submission.is_passed,
        "passed_count": submission.passed_count,
        "total_count": submission.total_count,
        "error_message": submission.error_message,
        "created_at": submission.created_at.isoformat(),
    }


def serialize_wrong_problem(wrong: WrongProblem) -> dict:
    problem = wrong.problem
    return {
        "id": wrong.id,
        "problem": {
            "id": problem.id,
            "title": problem.title,
            "category": problem.category.name if problem.category else "",
            "difficulty": problem.difficulty,
            "difficulty_label": problem.get_difficulty_display(),
        },
        "wrong_count": wrong.wrong_count,
        "last_wrong_at": wrong.last_wrong_at.isoformat() if wrong.last_wrong_at else None,
        "is_resolved": wrong.is_resolved,
    }


@require_POST
@require_auth
def create_submission(request):
    body = json_body(request)
    problem = get_object_or_404(Problem, id=body.get("problem_id"), is_published=True)

    submission = Submission.objects.create(
        user=request.user,
        problem=problem,
        code=body.get("code", ""),
        is_passed=bool(body.get("is_passed")),
        passed_count=int(body.get("passed_count") or 0),
        total_count=int(body.get("total_count") or 0),
        error_message=body.get("error_message", ""),
    )

    if submission.is_passed:
        WrongProblem.objects.filter(user=request.user, problem=problem).update(is_resolved=True)
    else:
        wrong, _ = WrongProblem.objects.get_or_create(
            user=request.user,
            problem=problem,
            defaults={"wrong_count": 0},
        )
        wrong.wrong_count += 1
        wrong.last_wrong_at = timezone.now()
        wrong.is_resolved = False
        wrong.save(update_fields=["wrong_count", "last_wrong_at", "is_resolved"])

    return JsonResponse({"submission": serialize_submission(submission)}, status=201)


@require_GET
@require_auth
def practice_stats(request):
    submissions = Submission.objects.filter(user=request.user).select_related("problem", "problem__category")
    practiced_count = submissions.values("problem_id").distinct().count()
    passed_problem_count = submissions.filter(is_passed=True).values("problem_id").distinct().count()
    unresolved_wrong_count = WrongProblem.objects.filter(
        user=request.user,
        is_resolved=False,
    ).count()
    pass_rate = round((passed_problem_count / practiced_count) * 100, 1) if practiced_count else 0

    return JsonResponse(
        {
            "stats": {
                "practiced_count": practiced_count,
                "passed_count": passed_problem_count,
                "failed_count": unresolved_wrong_count,
                "pass_rate": pass_rate,
            },
            "recent_submissions": [
                serialize_submission(submission)
                for submission in submissions[:20]
            ],
        }
    )


@require_GET
@require_auth
def wrong_problem_list(request):
    wrong_problems = WrongProblem.objects.filter(user=request.user).select_related(
        "problem",
        "problem__category",
    )
    return JsonResponse(
        {"wrong_problems": [serialize_wrong_problem(wrong) for wrong in wrong_problems]}
    )

