from django.core.cache import cache
from django.core.validators import MaxValueValidator
from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=80, unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "categories"

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        cache.delete("problem_categories")

    def delete(self, *args, **kwargs):
        result = super().delete(*args, **kwargs)
        cache.delete("problem_categories")
        return result


class Problem(models.Model):
    class Difficulty(models.TextChoices):
        BEGINNER = "beginner", "Beginner"
        BASIC = "basic", "Basic"
        INTERMEDIATE = "intermediate", "Intermediate"

    title = models.CharField(max_length=200, unique=True)
    description = models.TextField(max_length=20_000)
    difficulty = models.CharField(
        max_length=20,
        choices=Difficulty.choices,
        default=Difficulty.BEGINNER,
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="problems",
    )
    starter_code = models.TextField(max_length=20_000, blank=True)
    explanation = models.TextField(max_length=30_000, blank=True)
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["is_published", "-created_at"], name="problem_published_created"),
        ]

    def __str__(self) -> str:
        return self.title


class TestCase(models.Model):
    problem = models.ForeignKey(
        Problem,
        on_delete=models.CASCADE,
        related_name="test_cases",
    )
    stdin = models.TextField(max_length=65_536, blank=True)
    expected_stdout = models.TextField(max_length=65_536)
    is_public = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0, validators=[MaxValueValidator(9_999)])

    class Meta:
        ordering = ["order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["problem", "order"], name="unique_test_case_order"),
        ]

    def __str__(self) -> str:
        visibility = "public" if self.is_public else "hidden"
        return f"{self.problem.title} #{self.order} ({visibility})"
