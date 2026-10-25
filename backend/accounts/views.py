from rest_framework import generics
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from .serializers import UserSerializer


class MeView(generics.RetrieveUpdateAPIView):
    """Profil de l'utilisateur connecté (GET pour l'afficher, PATCH pour le modifier).

    JSON pour les champs texte, multipart pour envoyer une photo.
    """

    serializer_class = UserSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ["get", "patch"]

    def get_object(self):
        return self.request.user
