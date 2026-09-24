from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
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
    code = models.TextField(max_length=100_000)
    is_passed = models.BooleanField(default=False)
    passed_count = models.PositiveIntegerField(default=0, validators=[MaxValueValidator(100)])
    total_count = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(100)],
    )
    error_message = models.TextField(max_length=8_000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["user", "problem", "is_passed", "created_at"],
                name="submission_user_problem_passed",
            ),
            models.Index(fields=["user", "-created_at"], name="submission_user_created"),
        ]

    def __str__(self) -> str:
        status = "passed" if self.is_passed else "failed"
        return f"{self.user} - {self.problem} - {status}"

    def clean(self):
        if self.passed_count > self.total_count:
            raise ValidationError("通过测试点数量不能大于测试点总数。")
        if self.is_passed != (self.passed_count == self.total_count):
            raise ValidationError("提交结果与测试点统计不一致。")


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
        indexes = [
            models.Index(
                fields=["user", "is_resolved", "-last_wrong_at"],
                name="wrong_user_status_time",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user} - {self.problem} ({self.wrong_count})"
