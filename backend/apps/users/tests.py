import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .school_auth import SchoolIdentity, encrypted_password


class SchoolRegistrationTests(TestCase):
    def post_json(self, url: str, payload: dict):
        return self.client.post(url, data=json.dumps(payload), content_type="application/json")

    def test_password_registration_is_disabled(self):
        response = self.post_json(reverse("register"), {"username": "demo", "password": "password123"})

        self.assertEqual(response.status_code, 410)

    @patch("apps.users.views.poll_qr_registration")
    def test_school_registration_verifies_then_creates_user(self, poll_qr_registration):
        poll_qr_registration.return_value = SchoolIdentity(student_id="20240001")

        status_response = self.client.get(reverse("school-register-status", args=["session"]))
        self.assertEqual(status_response.status_code, 200)
        self.assertEqual(status_response.json()["status"], "verified")

        complete_response = self.post_json(
            reverse("school-register-complete"),
            {"username": "learner", "password": "password123"},
        )

        self.assertEqual(complete_response.status_code, 201)
        user = get_user_model().objects.get(student_id="20240001")
        self.assertEqual(user.username, "learner")

    @patch("apps.users.views.poll_qr_registration")
    def test_registered_student_is_logged_in_after_scan(self, poll_qr_registration):
        user = get_user_model().objects.create_user(
            username="learner",
            password="password123",
            student_id="20240001",
        )
        poll_qr_registration.return_value = SchoolIdentity(student_id=user.student_id)

        response = self.client.get(reverse("school-register-status", args=["session"]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "authenticated", "user": {
            "id": user.id,
            "username": user.username,
            "student_id": user.student_id,
        }})
        self.assertEqual(int(self.client.session["_auth_user_id"]), user.id)

    def test_cas_password_encryption_uses_aes(self):
        encrypted = encrypted_password("password123", "1234567890abcdef")

        self.assertTrue(encrypted)
        self.assertNotIn("password123", encrypted)
