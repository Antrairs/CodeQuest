import io
import json

from django.test import TestCase

from .importer import import_problem_json
from .models import Category, Problem, TestCase as ProblemTestCase


class ProblemImportTests(TestCase):
    def test_import_problem_json_creates_problem_and_preserves_output_whitespace(self):
        payload = {
            "problems": [
                {
                    "title": "打印三角形",
                    "description": "输出指定形状",
                    "difficulty": "beginner",
                    "category": "Python 基础",
                    "test_cases": [
                        {
                            "stdin": "",
                            "expected_stdout": "  *\n ***\n*****",
                            "is_public": True,
                            "order": 1,
                        }
                    ],
                }
            ]
        }

        result = import_problem_json(_json_file(payload))

        self.assertEqual(result.created_count, 1)
        self.assertEqual(result.skipped_count, 0)
        self.assertEqual(result.errors, [])
        problem = Problem.objects.get(title="打印三角形")
        self.assertEqual(problem.category, Category.objects.get(name="Python 基础"))
        self.assertTrue(problem.is_published)
        test_case = ProblemTestCase.objects.get(problem=problem)
        self.assertEqual(test_case.expected_stdout, "  *\n ***\n*****")

    def test_import_problem_json_skips_duplicate_titles(self):
        Problem.objects.create(
            title="重复题",
            description="已存在",
            difficulty=Problem.Difficulty.BEGINNER,
        )
        payload = {
            "problems": [
                {
                    "title": "重复题",
                    "description": "新内容",
                    "difficulty": "beginner",
                    "test_cases": [{"expected_stdout": "ok"}],
                }
            ]
        }

        result = import_problem_json(_json_file(payload))

        self.assertEqual(result.created_count, 0)
        self.assertEqual(result.skipped_count, 1)
        self.assertEqual(Problem.objects.count(), 1)

    def test_import_problem_json_rejects_invalid_difficulty(self):
        payload = {
            "problems": [
                {
                    "title": "非法难度",
                    "description": "不会导入",
                    "difficulty": "hard",
                    "test_cases": [{"expected_stdout": "ok"}],
                }
            ]
        }

        result = import_problem_json(_json_file(payload))

        self.assertEqual(result.created_count, 0)
        self.assertEqual(Problem.objects.count(), 0)
        self.assertEqual(len(result.errors), 1)

    def test_problem_list_is_paginated(self):
        Problem.objects.bulk_create(
            [
                Problem(
                    title=f"题目 {index}",
                    description="描述",
                    difficulty=Problem.Difficulty.BEGINNER,
                    is_published=True,
                )
                for index in range(25)
            ]
        )

        first = self.client.get("/api/problems/")
        second = self.client.get("/api/problems/?page=2")

        self.assertEqual(len(first.json()["problems"]), 24)
        self.assertEqual(len(second.json()["problems"]), 1)
        self.assertEqual(first.json()["pagination"]["pages"], 2)


def _json_file(payload):
    return io.BytesIO(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
