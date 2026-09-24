from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from apps.problems.models import Problem
from apps.submissions.models import Submission

from .models import Activity, ActivityCheckinClaim, ActivityProblem
from .services import activity_user_rows


class ActivityApiTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="student", password="password123")
        self.problem = Problem.objects.create(
            title="Hello",
            description="print hello",
            difficulty=Problem.Difficulty.BEGINNER,
            is_published=True,
        )
        self.activity = Activity.objects.create(
            name="社团刷题活动",
            description="完成题目后领取签到码",
            start_at=timezone.now() - timedelta(hours=1),
            end_at=timezone.now() + timedelta(hours=1),
            required_problem_count=1,
            checkin_code="ABC123",
            checkin_qr_image="activity_qrcodes/demo.png",
            status=Activity.Status.PUBLISHED,
        )
        ActivityProblem.objects.create(activity=self.activity, problem=self.problem, order=1)
        self.client = Client()

    def test_activity_progress_counts_passed_submission_in_activity_time(self):
        Submission.objects.create(
            user=self.user,
            problem=self.problem,
            code="print('hello')",
            is_passed=True,
            passed_count=1,
            total_count=1,
        )
        self.client.login(username="student", password="password123")

        response = self.client.get(f"/api/activities/{self.activity.id}/")

        self.assertEqual(response.status_code, 200)
        progress = response.json()["activity"]["progress"]
        self.assertEqual(progress["completed_count"], 1)
        self.assertTrue(progress["is_completed"])
        self.assertTrue(progress["can_claim"])

        list_response = self.client.get("/api/activities/")
        listed_progress = list_response.json()["activities"][0]["progress"]
        self.assertEqual(listed_progress["completed_count"], 1)
        self.assertEqual(list_response.json()["pagination"]["count"], 1)

    def test_claim_requires_completed_activity(self):
        self.client.login(username="student", password="password123")

        response = self.client.post(f"/api/activities/{self.activity.id}/claim/")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(ActivityCheckinClaim.objects.exists())

    def test_claim_returns_checkin_code_and_records_view_count(self):
        Submission.objects.create(
            user=self.user,
            problem=self.problem,
            code="print('hello')",
            is_passed=True,
            passed_count=1,
            total_count=1,
        )
        self.client.login(username="student", password="password123")

        first = self.client.post(f"/api/activities/{self.activity.id}/claim/")
        second = self.client.post(f"/api/activities/{self.activity.id}/claim/")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()["activity"]["checkin_code"], "ABC123")
        self.assertEqual(second.json()["activity"]["checkin_qr_image_url"], "/media/activity_qrcodes/demo.png")
        self.assertEqual(ActivityCheckinClaim.objects.get().view_count, 2)
        rows = activity_user_rows(self.activity)
        self.assertEqual(rows[0]["passed_count"], 1)
        self.assertEqual(rows[0]["claim"].view_count, 2)
