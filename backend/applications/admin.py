from django.contrib import admin

from .models import Application


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ["position", "company", "status", "applied_at", "owner"]
    list_filter = ["status"]
    search_fields = ["company", "position"]
