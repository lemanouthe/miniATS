from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from applications.models import Application

DEMO = [
    ("Zenith", "Développeur full stack", "interview", 3, "Entretien technique jeudi."),
    ("Doctolib", "Développeur front React", "applied", 6, ""),
    ("Alan", "Software engineer", "to_apply", None, "Relire la fiche de poste."),
    ("Qonto", "Développeur Django", "rejected", 20, "Retour : profil trop junior."),
    ("BlaBlaCar", "Front-end engineer", "applied", 9, ""),
    ("Back Market", "Développeur full stack", "offer", 30, "Offre reçue, à comparer."),
    ("Swile", "Développeur React / MUI", "to_apply", None, ""),
    ("Malt", "Développeur Python", "applied", 12, "Relance prévue la semaine prochaine."),
    ("Ledger", "Développeur front", "interview", 15, ""),
    ("Ornikar", "Développeur full stack", "applied", 4, ""),
    ("Payfit", "Développeur back Python", "rejected", 25, ""),
    ("Lydia", "Développeur React", "to_apply", None, ""),
]


class Command(BaseCommand):
    help = "Crée l'utilisateur de démo (demo@example.com / demo12345) et des candidatures d'exemple."

    def handle(self, *args, **options):
        User = get_user_model()
        user, created = User.objects.get_or_create(
            email="demo@example.com",
            defaults={
                "first_name": "Camille",
                "last_name": "Demo",
                "job_title": "Développeuse full stack React / Django",
                "location": "Paris",
                "linkedin_url": "https://www.linkedin.com/in/camille-demo",
                "bio": "Je cherche un poste full stack avec une forte dimension front (React, MUI).",
            },
        )
        if created:
            user.set_password("demo12345")
            user.save()
        if user.applications.exists():
            self.stdout.write("Données de démo déjà présentes.")
            return
        today = date.today()
        Application.objects.bulk_create(
            Application(
                owner=user,
                company=company,
                position=position,
                status=status,
                applied_at=today - timedelta(days=days) if days is not None else None,
                job_url=f"https://example.com/jobs/{company.lower().replace(' ', '-')}",
                notes=notes,
            )
            for company, position, status, days, notes in DEMO
        )
        self.stdout.write(self.style.SUCCESS("Utilisateur demo@example.com / demo12345 créé avec 12 candidatures."))
