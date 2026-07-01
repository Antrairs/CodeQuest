from dataclasses import dataclass

from django.contrib.auth import get_user_model

from apps.submissions.models import Submission

from .models import Activity, ActivityCheckinClaim


@dataclass
class ActivityProgress:
    completed_count: int
    required_count: int
    is_completed: bool
    claim: ActivityCheckinClaim | None


def passed_problem_ids(activity: Activity, user) -> set[int]:
    if not user.is_authenticated:
        return set()

    problem_ids = list(activity.problems.values_list("id", flat=True))
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
    completed_count = len(passed_problem_ids(activity, user))
    required_count = activity.required_problem_count
    claim = None
    if user.is_authenticated:
        claim = ActivityCheckinClaim.objects.filter(activity=activity, user=user).first()
    return ActivityProgress(
        completed_count=completed_count,
        required_count=required_count,
        is_completed=completed_count >= required_count,
        claim=claim,
    )


def can_claim(activity: Activity, user) -> bool:
    progress = activity_progress(activity, user)
    return (
        user.is_authenticated
        and activity.status == Activity.Status.PUBLISHED
        and progress.is_completed
    )


def claim_checkin(activity: Activity, user) -> ActivityCheckinClaim:
    claim, created = ActivityCheckinClaim.objects.get_or_create(activity=activity, user=user)
    if not created:
        claim.view_count += 1
        claim.save(update_fields=["view_count"])
    return claim


def activity_user_rows(activity: Activity) -> list[dict]:
    problem_ids = list(activity.problems.values_list("id", flat=True))
    User = get_user_model()
    users = User.objects.filter(
        submissions__problem_id__in=problem_ids,
        submissions__created_at__gte=activity.start_at,
        submissions__created_at__lte=activity.end_at,
    ).distinct()

    rows = []
    for user in users:
        passed_count = (
            Submission.objects.filter(
                user=user,
                problem_id__in=problem_ids,
                is_passed=True,
                created_at__gte=activity.start_at,
                created_at__lte=activity.end_at,
            )
            .values("problem_id")
            .distinct()
            .count()
        )
        claim = ActivityCheckinClaim.objects.filter(activity=activity, user=user).first()
        rows.append(
            {
                "user": user,
                "passed_count": passed_count,
                "is_completed": passed_count >= activity.required_problem_count,
                "claim": claim,
            }
        )
    return rows


def activity_summary(activity: Activity) -> dict:
    rows = activity_user_rows(activity)
    return {
        "participant_count": len(rows),
        "completed_count": sum(1 for row in rows if row["is_completed"]),
        "claimed_count": ActivityCheckinClaim.objects.filter(activity=activity).count(),
    }
