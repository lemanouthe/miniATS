from django.conf import settings
from django.db import models


class Application(models.Model):
    class Status(models.TextChoices):
        TO_APPLY = "to_apply", "À postuler"
        APPLIED = "applied", "Postulé"
        INTERVIEW = "interview", "Entretien"
        OFFER = "offer", "Offre"
        REJECTED = "rejected", "Refusé"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="applications",
    )
    company = models.CharField(max_length=200)
    position = models.CharField(max_length=200)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.TO_APPLY
    )
    job_url = models.URLField(max_length=500, blank=True)
    notes = models.TextField(blank=True)
    applied_at = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["owner", "status"])]

    def __str__(self):
        return f"{self.position} @ {self.company}"
