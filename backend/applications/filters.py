import django_filters

from .models import Application


class ApplicationFilter(django_filters.FilterSet):
    applied_after = django_filters.DateFilter(field_name="applied_at", lookup_expr="gte")
    applied_before = django_filters.DateFilter(field_name="applied_at", lookup_expr="lte")

    class Meta:
        model = Application
        fields = ["status", "applied_after", "applied_before"]
