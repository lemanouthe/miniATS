from rest_framework import generics
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from .serializers import UserSerializer


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ["get", "patch"]

    def get_object(self):
        return self.request.user
