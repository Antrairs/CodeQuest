from django import forms
from django.contrib import admin
from django.db import models

from .models import Category, Problem, TestCase


def preserve_whitespace(form, field_names):
    for name in field_names:
        field = form.fields.get(name)
        if isinstance(field, forms.CharField):
            field.strip = False


class ProblemAdminForm(forms.ModelForm):
    class Meta:
        model = Problem
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        preserve_whitespace(
            self,
            ("sample_input", "sample_output", "starter_code"),
        )


class TestCaseAdminForm(forms.ModelForm):
    class Meta:
        model = TestCase
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        preserve_whitespace(self, ("stdin", "expected_stdout"))


class TestCaseInline(admin.TabularInline):
    model = TestCase
    form = TestCaseAdminForm
    extra = 2
    fields = ("order", "is_public", "stdin", "expected_stdout")
    formfield_overrides = {
        models.TextField: {"widget": forms.Textarea(attrs={"rows": 3})},
    }


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    search_fields = ("name",)


@admin.register(Problem)
class ProblemAdmin(admin.ModelAdmin):
    form = ProblemAdminForm
    list_display = ("title", "category", "difficulty", "is_published", "created_at")
    list_filter = ("category", "difficulty", "is_published")
    search_fields = ("title", "description")
    inlines = [TestCaseInline]
    formfield_overrides = {
        models.TextField: {"widget": forms.Textarea(attrs={"rows": 4})},
    }
    fieldsets = (
        ("基础信息", {"fields": ("title", "description", "difficulty", "category", "is_published")}),
        (
            "输入输出说明",
            {
                "fields": ("input_description", "output_description"),
                "classes": ("collapse",),
            },
        ),
        (
            "样例展示",
            {
                "fields": ("sample_input", "sample_output"),
                "classes": ("collapse",),
                "description": "可不填。保存后会优先使用第一个公开测试用例自动补齐样例。",
            },
        ),
        (
            "初始代码与解析",
            {
                "fields": ("starter_code", "explanation"),
                "classes": ("collapse",),
            },
        ),
    )

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)

        problem = form.instance
        public_case = problem.test_cases.filter(is_public=True).first()
        if public_case is None:
            return

        update_fields = []
        if not problem.sample_input and public_case.stdin:
            problem.sample_input = public_case.stdin
            update_fields.append("sample_input")
        if not problem.sample_output and public_case.expected_stdout:
            problem.sample_output = public_case.expected_stdout
            update_fields.append("sample_output")

        if update_fields:
            update_fields.append("updated_at")
            problem.save(update_fields=update_fields)


@admin.register(TestCase)
class TestCaseAdmin(admin.ModelAdmin):
    form = TestCaseAdminForm
    list_display = ("problem", "order", "is_public")
    list_filter = ("is_public", "problem__category")
    search_fields = ("problem__title", "stdin", "expected_stdout")
