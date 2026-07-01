from django.urls import path

from . import views

urlpatterns = [
    path("me/", views.me, name="me"),
    path("register/", views.register, name="register"),
    path("register/school/start/", views.school_register_start, name="school-register-start"),
    path(
        "register/school/<str:session_id>/status/",
        views.school_register_status,
        name="school-register-status",
    ),
    path("register/school/complete/", views.school_register_complete, name="school-register-complete"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
]
