import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings

from apps.problems.models import Category, Problem, TestCase as ProblemTestCase
from apps.submissions.models import WrongProblem


@override_settings(ALLOWED_HOSTS=["testserver"])
class SubmissionApiFlowTests(TestCase):
    def setUp(self):
        category = Category.objects.create(name="基础语法")
        self.problem = Problem.objects.create(
            title="两数相加",
            description="输入两个整数，输出它们的和。",
            difficulty=Problem.Difficulty.BEGINNER,
            category=category,
            starter_code="a = int(input())\nb = int(input())\nprint(a + b)",
            is_published=True,
        )
        ProblemTestCase.objects.create(
            problem=self.problem,
            stdin="1\n2\n",
            expected_stdout="3\n",
            is_public=True,
            order=1,
        )
        self.user = get_user_model().objects.create_user(
            username="learner",
            password="password123",
            student_id="20240001",
        )

    def post_json(self, path: str, payload: dict):
        return self.client.post(
            path,
            data=json.dumps(payload),
            content_type="application/json",
        )

    def test_submission_updates_wrong_problem_until_resolved(self):
        self.client = Client()

        list_response = self.client.get("/api/problems/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.json()["problems"]), 1)

        anonymous_submit = self.post_json(
            "/api/submissions/",
            {
                "problem_id": self.problem.id,
                "code": "print(0)",
                "is_passed": False,
                "passed_count": 0,
                "total_count": 1,
                "error_message": "wrong answer",
            },
        )
        self.assertEqual(anonymous_submit.status_code, 401)

        self.client.force_login(self.user)

        failed_submit = self.post_json(
            "/api/submissions/",
            {
                "problem_id": self.problem.id,
                "code": "print(0)",
                "is_passed": False,
                "passed_count": 0,
                "total_count": 1,
                "error_message": "wrong answer",
            },
        )
        self.assertEqual(failed_submit.status_code, 201)

        wrong = WrongProblem.objects.get(problem=self.problem)
        self.assertEqual(wrong.wrong_count, 1)
        self.assertFalse(wrong.is_resolved)

        passed_submit = self.post_json(
            "/api/submissions/",
            {
                "problem_id": self.problem.id,
                "code": "print(3)",
                "is_passed": True,
                "passed_count": 1,
                "total_count": 1,
                "error_message": "",
            },
        )
        self.assertEqual(passed_submit.status_code, 201)

        wrong.refresh_from_db()
        self.assertTrue(wrong.is_resolved)

        stats_response = self.client.get("/api/submissions/stats/")
        self.assertEqual(stats_response.status_code, 200)
        self.assertEqual(stats_response.json()["stats"]["passed_count"], 1)

    def test_submission_rejects_inconsistent_counts(self):
        self.client.force_login(self.user)

        response = self.post_json(
            "/api/submissions/",
            {
                "problem_id": self.problem.id,
                "code": "print(3)",
                "is_passed": True,
                "passed_count": 0,
                "total_count": 1,
                "error_message": "",
            },
        )

        self.assertEqual(response.status_code, 400)
