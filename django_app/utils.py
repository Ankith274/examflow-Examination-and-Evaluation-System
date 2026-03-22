"""django_app/utils.py"""
from rest_framework.views import exception_handler
from rest_framework.response import Response


def custom_exception_handler(exc, context):
    """Wrap DRF exceptions in our standard {success, message} envelope."""
    response = exception_handler(exc, context)
    if response is not None:
        message = ""
        if isinstance(response.data, dict):
            message = response.data.get("detail", str(response.data))
        elif isinstance(response.data, list):
            message = "; ".join(str(e) for e in response.data)
        else:
            message = str(response.data)
        response.data = {"success": False, "message": str(message)}
    return response


def success_response(data=None, message="success", status=200):
    body = {"success": True, "message": message}
    if data is not None:
        body["data"] = data
    return Response(body, status=status)


def error_response(message="Error", status=400, errors=None):
    body = {"success": False, "message": message}
    if errors:
        body["errors"] = errors
    return Response(body, status=status)
