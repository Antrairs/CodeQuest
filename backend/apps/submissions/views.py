import json
from functools import wraps

import sqlparse

from django.conf import settings
from django.db import connection

from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db.models import Count, F, Q
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

    code = body.get("code")
    error_message = body.get("error_message", "")
    passed_count = body.get("passed_count")
    total_count = body.get("total_count")
    is_passed = body.get("is_passed")
    if (
        not isinstance(code, str)
        or not isinstance(error_message, str)
        or not isinstance(passed_count, int)
        or isinstance(passed_count, bool)
        or not isinstance(total_count, int)
        or isinstance(total_count, bool)
        or not isinstance(is_passed, bool)
    ):
        return JsonResponse({"error": "提交数据格式不正确。"}, status=400)

    submission = Submission(
        user=request.user,
        problem=problem,
        code=code,
        is_passed=is_passed,
        passed_count=passed_count,
        total_count=total_count,
        error_message=error_message,
    )
    try:
        submission.full_clean()
    except ValidationError as error:
        return JsonResponse({"error": "；".join(error.messages)}, status=400)

    def print_sql(execute, sql, params, many, context):
        if settings.DEBUG and sql.lstrip().upper().startswith(("INSERT", "UPDATE")):
            print("\n[SQL] 提交代码\n" + sqlparse.format(sql, reindent=True, keyword_case="upper") + "\n", flush=True)
        return execute(sql, params, many, context)

    with connection.execute_wrapper(print_sql):
        submission.save()

        if submission.is_passed:
            WrongProblem.objects.filter(user=request.user, problem=problem).update(is_resolved=True)
        else:
            wrong, _ = WrongProblem.objects.get_or_create(
                user=request.user,
                problem=problem,
                defaults={"wrong_count": 0},
            )
            WrongProblem.objects.filter(pk=wrong.pk).update(
                wrong_count=F("wrong_count") + 1,
                last_wrong_at=timezone.now(),
                is_resolved=False,
            )

    return JsonResponse({"submission": serialize_submission(submission)}, status=201)


@require_GET
@require_auth
def practice_stats(request):
    submissions = Submission.objects.filter(user=request.user).select_related("problem", "problem__category")

    def print_sql(execute, sql, params, many, context):
        if settings.DEBUG:
            print("\n[SQL] 我的练习统计\n" + sqlparse.format(sql, reindent=True, keyword_case="upper") + "\n", flush=True)
        return execute(sql, params, many, context)

    with connection.execute_wrapper(print_sql):
        counts = submissions.aggregate(
            practiced_count=Count("problem_id", distinct=True),
            passed_problem_count=Count("problem_id", filter=Q(is_passed=True), distinct=True),
        )
    practiced_count = counts["practiced_count"]
    passed_problem_count = counts["passed_problem_count"]
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
    page = Paginator(wrong_problems, 20).get_page(request.GET.get("page"))
    return JsonResponse(
        {
            "wrong_problems": [serialize_wrong_problem(wrong) for wrong in page],
            "pagination": {
                "page": page.number,
                "pages": page.paginator.num_pages,
                "count": page.paginator.count,
                "has_previous": page.has_previous(),
                "has_next": page.has_next(),
            },
        }
    )
