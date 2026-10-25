from django.conf import settings
from django.db import connection
from django.http import FileResponse, Http404, JsonResponse


def health(request):
    """Utilisé par le healthcheck Docker et le script de déploiement."""
    try:
        connection.ensure_connection()
    except Exception:
        return JsonResponse({"status": "error", "database": "unreachable"}, status=503)
    return JsonResponse({"status": "ok"})


def spa_index(request):
    """Renvoie index.html pour les routes du front (/applications/12, /profile…).

    React Router gère ensuite la route côté navigateur ; sans ça, un rechargement donnerait un 404.
    """
    index = settings.FRONTEND_DIST / "index.html"
    if not index.is_file():
        raise Http404("Front non buildé.")
    response = FileResponse(index.open("rb"), content_type="text/html; charset=utf-8")
    # index.html ne doit pas être mis en cache : il référence les assets versionnés du dernier build.
    response["Cache-Control"] = "no-cache"
    return response
