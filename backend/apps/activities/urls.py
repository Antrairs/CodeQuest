from django.urls import path

from . import views

urlpatterns = [
    path("", views.activity_list, name="activity-list"),
    path("<int:activity_id>/", views.activity_detail, name="activity-detail"),
    path("<int:activity_id>/claim/", views.claim_activity, name="activity-claim"),
]
