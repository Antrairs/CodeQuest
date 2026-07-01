from django import forms
from django.contrib import admin, messages
from django.db import models
from django.shortcuts import redirect, render
from django.urls import path, reverse

from .importer import import_problem_json
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
        preserve_whitespace(self, ("starter_code", "explanation"))


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


class ProblemImportForm(forms.Form):
    file = forms.FileField(label="JSON 文件")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    search_fields = ("name",)


@admin.register(Problem)
class ProblemAdmin(admin.ModelAdmin):
    form = ProblemAdminForm
    change_list_template = "admin/problems/problem/change_list.html"
    list_display = ("title", "category", "difficulty", "is_published", "created_at")
    list_filter = ("category", "difficulty", "is_published")
    search_fields = ("title", "description")
    inlines = [TestCaseInline]
    fieldsets = (
        ("题目", {"fields": ("title", "description", "difficulty", "category", "is_published")}),
        ("练习辅助", {"fields": ("starter_code", "explanation"), "classes": ("collapse",)}),
    )
    formfield_overrides = {
        models.TextField: {"widget": forms.Textarea(attrs={"rows": 4})},
    }

    def get_urls(self):
        return [
            path(
                "import/",
                self.admin_site.admin_view(self.import_view),
                name="problems_problem_import",
            ),
        ] + super().get_urls()

    def import_view(self, request):
        if request.method == "POST":
            form = ProblemImportForm(request.POST, request.FILES)
            if form.is_valid():
                result = import_problem_json(form.cleaned_data["file"])
                if result.created_count:
                    messages.success(request, f"成功导入 {result.created_count} 道题。")
                if result.skipped_count:
                    messages.warning(request, f"跳过 {result.skipped_count} 道重复题。")
                for error in result.errors:
                    messages.error(request, error)
                if not result.errors:
                    return redirect(reverse("admin:problems_problem_changelist"))
        else:
            form = ProblemImportForm()

        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "form": form,
            "title": "批量导入题库",
        }
        return render(request, "admin/problems/problem/import.html", context)


@admin.register(TestCase)
class TestCaseAdmin(admin.ModelAdmin):
    form = TestCaseAdminForm
    list_display = ("problem", "order", "is_public")
    list_filter = ("is_public", "problem__category")
    search_fields = ("problem__title", "stdin", "expected_stdout")
