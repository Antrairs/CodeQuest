from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("账户信息", {"fields": ("email", "student_id")}),
        (
            "权限",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("重要日期", {"fields": ("last_login", "date_joined")}),
    )
    list_display = ("username", "student_id", "is_staff")
    search_fields = ("username", "student_id")
