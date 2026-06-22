from django.contrib import admin

from .models import Submission, WrongProblem


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ("user", "problem", "is_passed", "passed_count", "total_count", "created_at")
    list_filter = ("is_passed", "problem__category", "created_at")
    search_fields = ("user__username", "problem__title", "code", "error_message")
    readonly_fields = ("created_at",)


@admin.register(WrongProblem)
class WrongProblemAdmin(admin.ModelAdmin):
    list_display = ("user", "problem", "wrong_count", "last_wrong_at", "is_resolved")
    list_filter = ("is_resolved", "problem__category", "last_wrong_at")
    search_fields = ("user__username", "problem__title")

