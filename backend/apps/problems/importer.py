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

    valid_difficulties = {value for value, _ in Problem.Difficulty.choices}
    for index, raw_problem in enumerate(problems, start=1):
        if not isinstance(raw_problem, dict):
            result.errors.append(f"第 {index} 道题必须是对象。")
            continue

        title = raw_problem.get("title")
        if not isinstance(title, str) or not title.strip():
            result.errors.append(f"第 {index} 道题缺少 title。")
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
    first_public_case = next((case for case in raw_cases if case.get("is_public", False)), None)
    sample_input = _text(raw_problem.get("sample_input"))
    sample_output = _text(raw_problem.get("sample_output"))
    if first_public_case:
        sample_input = sample_input or _text(first_public_case.get("stdin"))
        sample_output = sample_output or _text(first_public_case.get("expected_stdout"))

    problem = Problem.objects.create(
        title=title,
        description=_text(raw_problem.get("description")),
        difficulty=difficulty,
        category=category,
        input_description=_text(raw_problem.get("input_description")),
        output_description=_text(raw_problem.get("output_description")),
        sample_input=sample_input,
        sample_output=sample_output,
        starter_code=_text(raw_problem.get("starter_code")),
        explanation=_text(raw_problem.get("explanation")),
        is_published=bool(raw_problem.get("is_published", False)),
    )

    test_cases = [
        TestCase(
            problem=problem,
            stdin=_text(raw_case.get("stdin")),
            expected_stdout=raw_case["expected_stdout"],
            is_public=bool(raw_case.get("is_public", False)),
            order=_int(raw_case.get("order"), index),
        )
        for index, raw_case in enumerate(raw_cases, start=1)
    ]
    TestCase.objects.bulk_create(test_cases)


def _get_category(value: Any) -> Category | None:
    if not isinstance(value, str) or not value.strip():
        return None
    category, _ = Category.objects.get_or_create(name=value.strip())
    return category


def _text(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _int(value: Any, default: int) -> int:
    return value if isinstance(value, int) and value >= 0 else default
