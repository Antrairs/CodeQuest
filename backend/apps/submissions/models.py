from django.conf import settings
from django.db import models

from apps.problems.models import Problem


class Submission(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    problem = models.ForeignKey(
        Problem,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    code = models.TextField()
    is_passed = models.BooleanField(default=False)
    passed_count = models.PositiveIntegerField(default=0)
    total_count = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        status = "passed" if self.is_passed else "failed"
        return f"{self.user} - {self.problem} - {status}"


class WrongProblem(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wrong_problems",
    )
    problem = models.ForeignKey(
        Problem,
        on_delete=models.CASCADE,
        related_name="wrong_records",
    )
    wrong_count = models.PositiveIntegerField(default=0)
    last_wrong_at = models.DateTimeField(null=True, blank=True)
    is_resolved = models.BooleanField(default=False)

    class Meta:
        unique_together = ("user", "problem")
        ordering = ["is_resolved", "-last_wrong_at"]

    def __str__(self) -> str:
        return f"{self.user} - {self.problem} ({self.wrong_count})"

