from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    first_name = None
    last_name = None
    student_id = models.CharField(max_length=32, unique=True, null=True, blank=True)

    def get_full_name(self) -> str:
        return self.username

    def get_short_name(self) -> str:
        return self.username
