from django.conf import settings
from django.db import connection
from django.http import FileResponse, Http404, JsonResponse


def health(request):
    try:
        connection.ensure_connection()
    except Exception:
        return JsonResponse({"status": "error", "database": "unreachable"}, status=503)
    return JsonResponse({"status": "ok"})


def spa_index(request):
    index = settings.FRONTEND_DIST / "index.html"
    if not index.is_file():
        raise Http404("Front non buildé.")
    response = FileResponse(index.open("rb"), content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "no-cache"
    return response
