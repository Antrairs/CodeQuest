from django.urls import path

from . import views

urlpatterns = [
    path("", views.create_submission, name="submission-create"),
    path("stats/", views.practice_stats, name="practice-stats"),
    path("wrong-problems/", views.wrong_problem_list, name="wrong-problem-list"),
]

