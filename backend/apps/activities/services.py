from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.db.models import Count, F, Prefetch, Q

from apps.submissions.models import Submission

from .models import Activity, ActivityCheckinClaim


@dataclass
class ActivityProgress:
    completed_count: int
    required_count: int
    is_completed: bool
    claim: ActivityCheckinClaim | None
    passed_ids: set[int]


def passed_problem_ids(activity: Activity, user) -> set[int]:
    if not user.is_authenticated:
        return set()

    problem_ids = [link.problem_id for link in activity.activity_problems.all()]
    if not problem_ids:
        return set()

    return set(
        Submission.objects.filter(
            user=user,
            problem_id__in=problem_ids,
            is_passed=True,
            created_at__gte=activity.start_at,
            created_at__lte=activity.end_at,
        ).values_list("problem_id", flat=True)
    )


def activity_progress(activity: Activity, user) -> ActivityProgress:
    if hasattr(activity, "user_completed_count"):
        passed_ids = set()
        completed_count = activity.user_completed_count
    else:
        passed_ids = passed_problem_ids(activity, user)
        completed_count = len(passed_ids)
    required_count = activity.required_problem_count
    claim = None
    if user.is_authenticated:
        claims = getattr(activity, "user_claims", None)
        if claims is not None:
            claim = claims[0] if claims else None
        else:
            claim = ActivityCheckinClaim.objects.filter(activity=activity, user=user).first()
    return ActivityProgress(
        completed_count=completed_count,
        required_count=required_count,
        is_completed=completed_count >= required_count,
        claim=claim,
        passed_ids=passed_ids,
    )


def can_claim(activity: Activity, user, progress: ActivityProgress | None = None) -> bool:
    progress = progress or activity_progress(activity, user)
    return (
        user.is_authenticated
        and activity.status == Activity.Status.PUBLISHED
        and progress.is_completed
    )


def claim_checkin(activity: Activity, user) -> ActivityCheckinClaim:
    claim, created = ActivityCheckinClaim.objects.get_or_create(activity=activity, user=user)
    if not created:
        ActivityCheckinClaim.objects.filter(pk=claim.pk).update(view_count=F("view_count") + 1)
        claim.refresh_from_db(fields=["view_count"])
    return claim


def activity_user_rows(activity: Activity) -> list[dict]:
    problem_ids = list(activity.problems.values_list("id", flat=True))
    User = get_user_model()
    users = User.objects.filter(
        submissions__problem_id__in=problem_ids,
        submissions__created_at__gte=activity.start_at,
        submissions__created_at__lte=activity.end_at,
    ).annotate(
        activity_passed_count=Count(
            "submissions__problem_id",
            filter=Q(
                submissions__problem_id__in=problem_ids,
                submissions__is_passed=True,
                submissions__created_at__gte=activity.start_at,
                submissions__created_at__lte=activity.end_at,
            ),
            distinct=True,
        )
    ).prefetch_related(
        Prefetch(
            "activity_checkin_claims",
            queryset=ActivityCheckinClaim.objects.filter(activity=activity),
            to_attr="current_activity_claims",
        )
    )

    rows = []
    for user in users:
        passed_count = user.activity_passed_count
        claim = user.current_activity_claims[0] if user.current_activity_claims else None
        rows.append(
            {
                "user": user,
                "passed_count": passed_count,
                "is_completed": passed_count >= activity.required_problem_count,
                "claim": claim,
            }
        )
    return rows


def activity_summary(activity: Activity, rows: list[dict] | None = None) -> dict:
    rows = rows if rows is not None else activity_user_rows(activity)
    return {
        "participant_count": len(rows),
        "completed_count": sum(1 for row in rows if row["is_completed"]),
        "claimed_count": sum(1 for row in rows if row["claim"]),
    }
