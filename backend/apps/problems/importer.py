import json
from dataclasses import dataclass, field
from typing import Any

from django.db import transaction

from .models import Category, Problem, TestCase


@dataclass
class ProblemImportResult:
    created_count: int = 0
    skipped_count: int = 0
    errors: list[str] = field(default_factory=list)


def import_problem_json(file_obj) -> ProblemImportResult:
    try:
        payload = json.load(file_obj)
    except json.JSONDecodeError as exc:
        return ProblemImportResult(errors=[f"JSON 解析失败：{exc}"])
    except UnicodeDecodeError as exc:
        return ProblemImportResult(errors=[f"文件编码错误，请使用 UTF-8：{exc}"])

    result = ProblemImportResult()
    problems = payload.get("problems") if isinstance(payload, dict) else None
    if not isinstance(problems, list):
        result.errors.append('JSON 顶层必须是对象，并包含数组字段 "problems"。')
        return result
    if len(problems) > 200:
        return ProblemImportResult(errors=["单次最多导入 200 道题。"])

    valid_difficulties = {value for value, _ in Problem.Difficulty.choices}
    for index, raw_problem in enumerate(problems, start=1):
        if not isinstance(raw_problem, dict):
            result.errors.append(f"第 {index} 道题必须是对象。")
            continue

        title = raw_problem.get("title")
        if not isinstance(title, str) or not title.strip():
            result.errors.append(f"第 {index} 道题缺少 title。")
            continue
        if len(title) > 200:
            result.errors.append(f"第 {index} 道题标题不能超过 200 个字符。")
            continue

        if Problem.objects.filter(title=title).exists():
            result.skipped_count += 1
            continue

        difficulty = raw_problem.get("difficulty", Problem.Difficulty.BEGINNER)
        if difficulty not in valid_difficulties:
            result.errors.append(f"题目《{title}》difficulty 非法：{difficulty}")
            continue

        raw_cases = raw_problem.get("test_cases")
        if not isinstance(raw_cases, list) or not raw_cases:
            result.errors.append(f"题目《{title}》缺少 test_cases。")
            continue
        if len(raw_cases) > 100:
            result.errors.append(f"题目《{title}》最多包含 100 个测试用例。")
            continue

        case_errors = _validate_test_cases(title, raw_cases)
        if case_errors:
            result.errors.extend(case_errors)
            continue

        try:
            with transaction.atomic():
                _create_problem(raw_problem, title, difficulty, raw_cases)
        except Exception as exc:
            result.errors.append(f"题目《{title}》导入失败：{exc}")
            continue

        result.created_count += 1

    return result


def _validate_test_cases(title: str, raw_cases: list[Any]) -> list[str]:
    errors = []
    for index, raw_case in enumerate(raw_cases, start=1):
        if not isinstance(raw_case, dict):
            errors.append(f"题目《{title}》第 {index} 个测试用例必须是对象。")
            continue
        expected_stdout = raw_case.get("expected_stdout")
        if not isinstance(expected_stdout, str):
            errors.append(f"题目《{title}》第 {index} 个测试用例缺少 expected_stdout。")
    return errors


def _create_problem(
    raw_problem: dict[str, Any],
    title: str,
    difficulty: str,
    raw_cases: list[dict[str, Any]],
) -> None:
    category = _get_category(raw_problem.get("category"))
    problem = Problem(
        title=title,
        description=_text(raw_problem.get("description")),
        difficulty=difficulty,
        category=category,
        starter_code=_text(raw_problem.get("starter_code")),
        explanation=_text(raw_problem.get("explanation")),
        is_published=_bool(raw_problem.get("is_published"), True),
    )
    problem.full_clean()
    problem.save()

    test_cases = [
        TestCase(
            problem=problem,
            stdin=_text(raw_case.get("stdin")),
            expected_stdout=raw_case["expected_stdout"],
            is_public=_bool(raw_case.get("is_public"), False),
            order=_int(raw_case.get("order"), index),
        )
        for index, raw_case in enumerate(raw_cases, start=1)
    ]
    for test_case in test_cases:
        test_case.full_clean()
    TestCase.objects.bulk_create(test_cases)


def _get_category(value: Any) -> Category | None:
    if not isinstance(value, str) or not value.strip():
        return None
    if len(value.strip()) > 80:
        raise ValueError("分类名称不能超过 80 个字符。")
    category, _ = Category.objects.get_or_create(name=value.strip())
    return category


def _text(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _int(value: Any, default: int) -> int:
    return value if isinstance(value, int) and value >= 0 else default


def _bool(value: Any, default: bool) -> bool:
    return value if isinstance(value, bool) else default
