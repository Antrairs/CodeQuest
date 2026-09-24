from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator, MaxValueValidator, MinValueValidator
from django.db import models

from apps.problems.models import Problem


class Activity(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        CLOSED = "closed", "Closed"

    name = models.CharField(max_length=200)
    description = models.TextField(max_length=10_000, blank=True)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    required_problem_count = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(500)],
    )
    checkin_code = models.CharField(max_length=200, blank=True)
    checkin_qr_image = models.FileField(
        upload_to="activity_qrcodes/",
        blank=True,
        validators=[FileExtensionValidator(["png", "jpg", "jpeg", "webp"])],
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    problems = models.ManyToManyField(
        Problem,
        through="ActivityProblem",
        related_name="activities",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_at", "-created_at"]
        indexes = [
            models.Index(fields=["status", "-start_at"], name="activity_status_start"),
        ]

    def __str__(self) -> str:
        return self.name

    def clean(self):
        if self.start_at >= self.end_at:
            raise ValidationError({"end_at": "结束时间必须晚于开始时间。"})


class ActivityProblem(models.Model):
    activity = models.ForeignKey(
        Activity,
        on_delete=models.CASCADE,
        related_name="activity_problems",
    )
    problem = models.ForeignKey(
        Problem,
        on_delete=models.CASCADE,
        related_name="activity_links",
    )
    order = models.PositiveIntegerField(default=0, validators=[MaxValueValidator(9_999)])

    class Meta:
        ordering = ["order", "id"]
        unique_together = ("activity", "problem")
        indexes = [
            models.Index(fields=["activity", "order"], name="activity_problem_order"),
        ]

    def __str__(self) -> str:
        return f"{self.activity} - {self.problem}"


class ActivityCheckinClaim(models.Model):
    activity = models.ForeignKey(
        Activity,
        on_delete=models.CASCADE,
        related_name="checkin_claims",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="activity_checkin_claims",
    )
    claimed_at = models.DateTimeField(auto_now_add=True)
    view_count = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ("activity", "user")
        ordering = ["-claimed_at"]

    def __str__(self) -> str:
        return f"{self.user} - {self.activity}"
