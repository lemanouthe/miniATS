from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets

from .filters import ApplicationFilter
from .models import Application
from .serializers import ApplicationSerializer


class ApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = ApplicationSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ApplicationFilter
    search_fields = ["company", "position", "notes"]
    ordering_fields = ["applied_at", "created_at", "company", "status"]

    def get_queryset(self):
        return Application.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
