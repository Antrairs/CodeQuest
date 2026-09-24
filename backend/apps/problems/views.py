from django.core.cache import cache
from django.core.paginator import Paginator
from django.db.models import Exists, OuterRef
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET

from apps.submissions.models import Submission, WrongProblem

from .models import Category, Problem, TestCase


def serialize_category(category: Category | None) -> dict | None:
    if category is None:
        return None
    return {"id": category.id, "name": category.name}


def serialize_test_case(test_case: TestCase) -> dict:
    return {
        "id": test_case.id,
        "stdin": test_case.stdin,
        "expected_stdout": test_case.expected_stdout,
        "is_public": test_case.is_public,
        "order": test_case.order,
    }


def user_problem_state(problem: Problem, user) -> dict:
    if not user.is_authenticated:
        return {
            "is_passed": False,
            "has_failed": False,
            "is_wrong_resolved": False,
        }

    if hasattr(problem, "user_is_passed"):
        return {
            "is_passed": problem.user_is_passed,
            "has_failed": problem.user_has_failed,
            "is_wrong_resolved": problem.user_wrong_resolved,
        }

    wrong = WrongProblem.objects.filter(user=user, problem=problem).first()
    return {
        "is_passed": Submission.objects.filter(
            user=user,
            problem=problem,
            is_passed=True,
        ).exists(),
        "has_failed": wrong is not None and wrong.wrong_count > 0,
        "is_wrong_resolved": bool(wrong and wrong.is_resolved),
    }


def serialize_problem(problem: Problem, user, include_cases: bool = False) -> dict:
    data = {
        "id": problem.id,
        "title": problem.title,
        "description": problem.description,
        "difficulty": problem.difficulty,
        "difficulty_label": problem.get_difficulty_display(),
        "category": serialize_category(problem.category),
        "starter_code": problem.starter_code,
        "explanation": problem.explanation,
        "is_published": problem.is_published,
        "created_at": problem.created_at.isoformat(),
        "updated_at": problem.updated_at.isoformat(),
        "state": user_problem_state(problem, user),
    }
    if include_cases:
        test_cases = [serialize_test_case(case) for case in problem.test_cases.all()]
        data["test_cases"] = test_cases
        data["public_test_cases"] = [case for case in test_cases if case["is_public"]]
    return data


@require_GET
def problem_list(request):
    problems = Problem.objects.filter(is_published=True).select_related("category")

    category_id = request.GET.get("category")
    if category_id:
        problems = problems.filter(category_id=category_id)

    difficulty = request.GET.get("difficulty")
    if difficulty:
        problems = problems.filter(difficulty=difficulty)

    status = request.GET.get("status")
    if request.user.is_authenticated:
        submissions = Submission.objects.filter(user=request.user, problem_id=OuterRef("pk"))
        wrong_records = WrongProblem.objects.filter(user=request.user, problem_id=OuterRef("pk"))
        problems = problems.annotate(
            user_is_passed=Exists(submissions.filter(is_passed=True)),
            user_has_submission=Exists(submissions),
            user_has_failed=Exists(wrong_records),
            user_wrong_resolved=Exists(wrong_records.filter(is_resolved=True)),
        )

        if status == "passed":
            problems = problems.filter(user_is_passed=True)
        elif status == "failed":
            problems = problems.filter(user_has_failed=True, user_wrong_resolved=False)
        elif status == "untouched":
            problems = problems.filter(user_has_submission=False)

    page = Paginator(problems, 24).get_page(request.GET.get("page"))
    categories = cache.get("problem_categories")
    if categories is None:
        categories = [serialize_category(category) for category in Category.objects.all()]
        cache.set("problem_categories", categories, 300)
    return JsonResponse(
        {
            "problems": [serialize_problem(problem, request.user) for problem in page],
            "categories": categories,
            "difficulties": [
                {"value": value, "label": label}
                for value, label in Problem.Difficulty.choices
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
def problem_detail(request, problem_id: int):
    problem = get_object_or_404(
        Problem.objects.filter(is_published=True).select_related("category").prefetch_related("test_cases"),
        id=problem_id,
    )
    return JsonResponse({"problem": serialize_problem(problem, request.user, include_cases=True)})
