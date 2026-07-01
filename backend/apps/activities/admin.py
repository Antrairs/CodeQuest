import csv

from django.contrib import admin
from django.http import HttpResponse
from django.shortcuts import render
from django.urls import path, reverse
from django.utils.html import format_html

from .models import Activity, ActivityCheckinClaim, ActivityProblem
from .services import activity_summary, activity_user_rows


class ActivityProblemInline(admin.TabularInline):
    model = ActivityProblem
    extra = 1
    autocomplete_fields = ("problem",)
    fields = ("order", "problem")


class ActivityCheckinClaimInline(admin.TabularInline):
    model = ActivityCheckinClaim
    extra = 0
    can_delete = False
    readonly_fields = ("user", "claimed_at", "view_count")
    fields = readonly_fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "status",
        "start_at",
        "end_at",
        "required_problem_count",
        "participant_count",
        "completed_count",
        "claimed_count",
        "report_link",
        "export_link",
    )
    list_filter = ("status", "start_at")
    search_fields = ("name", "description")
    inlines = [ActivityProblemInline, ActivityCheckinClaimInline]
    fieldsets = (
        ("基本信息", {"fields": ("name", "description", "status")}),
        ("活动时间与规则", {"fields": ("start_at", "end_at", "required_problem_count")}),
        ("签到信息", {"fields": ("checkin_code", "checkin_qr_image")}),
    )

    def get_urls(self):
        urls = super().get_urls()
        return [
            path(
                "<int:activity_id>/export/",
                self.admin_site.admin_view(self.export_view),
                name="activities_activity_export",
            ),
            path(
                "<int:activity_id>/report/",
                self.admin_site.admin_view(self.report_view),
                name="activities_activity_report",
            )
        ] + urls

    def participant_count(self, obj):
        return activity_summary(obj)["participant_count"]

    def completed_count(self, obj):
        return activity_summary(obj)["completed_count"]

    def claimed_count(self, obj):
        return activity_summary(obj)["claimed_count"]

    def export_view(self, request, activity_id):
        activity = Activity.objects.get(id=activity_id)
        response = HttpResponse(content_type="text/csv; charset=utf-8-sig")
        response["Content-Disposition"] = f'attachment; filename="activity-{activity_id}.csv"'
        writer = csv.writer(response)
        writer.writerow(["用户名", "通过题目数", "是否完成", "是否领取", "领取时间", "查看次数"])
        for row in activity_user_rows(activity):
            claim = row["claim"]
            writer.writerow(
                [
                    row["user"].username,
                    row["passed_count"],
                    "是" if row["is_completed"] else "否",
                    "是" if claim else "否",
                    claim.claimed_at.isoformat() if claim else "",
                    claim.view_count if claim else 0,
                ]
            )
        return response

    def report_view(self, request, activity_id):
        activity = Activity.objects.get(id=activity_id)
        rows = activity_user_rows(activity)
        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "title": f"活动数据：{activity.name}",
            "activity": activity,
            "summary": activity_summary(activity),
            "rows": rows,
            "export_url": reverse("admin:activities_activity_export", args=[activity.id]),
        }
        return render(request, "admin/activities/activity/report.html", context)

    def report_link(self, obj):
        url = reverse("admin:activities_activity_report", args=[obj.id])
        return format_html('<a href="{}">查看数据</a>', url)

    def export_link(self, obj):
        url = reverse("admin:activities_activity_export", args=[obj.id])
        return format_html('<a href="{}">导出名单</a>', url)

    report_link.short_description = "数据"
    export_link.short_description = "导出"


@admin.register(ActivityCheckinClaim)
class ActivityCheckinClaimAdmin(admin.ModelAdmin):
    list_display = ("activity", "user", "claimed_at", "view_count")
    list_filter = ("activity",)
    search_fields = ("activity__name", "user__username")
    readonly_fields = ("activity", "user", "claimed_at", "view_count")
