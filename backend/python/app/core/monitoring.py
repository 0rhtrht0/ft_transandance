from __future__ import annotations

import time

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

try:
    from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
except ModuleNotFoundError:  # pragma: no cover - fallback for lean test environments
    CONTENT_TYPE_LATEST = "text/plain; version=0.0.4"

    class _NoopMetric:
        def labels(self, **_kwargs):
            return self

        def inc(self, *_args, **_kwargs):
            return None

        def dec(self, *_args, **_kwargs):
            return None

        def observe(self, *_args, **_kwargs):
            return None

        def set(self, *_args, **_kwargs):
            return None

    def Counter(*_args, **_kwargs):
        return _NoopMetric()

    def Gauge(*_args, **_kwargs):
        return _NoopMetric()

    def Histogram(*_args, **_kwargs):
        return _NoopMetric()

    def generate_latest():
        return b""


APP_INFO = Gauge(
    "blackhole_app_info",
    "Application metadata",
    labelnames=("service", "version"),
)
HTTP_REQUESTS_TOTAL = Counter(
    "blackhole_http_requests_total",
    "Total HTTP requests handled by the application",
    labelnames=("method", "path", "status"),
)
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "blackhole_http_request_duration_seconds",
    "HTTP request duration in seconds",
    labelnames=("method", "path"),
)
HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "blackhole_http_requests_in_progress",
    "HTTP requests currently in progress",
    labelnames=("method", "path"),
)


def _resolve_path(request: Request) -> str:
    route = request.scope.get("route")
    route_path = getattr(route, "path", None)
    if isinstance(route_path, str) and route_path:
        return route_path
    return request.url.path


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = _resolve_path(request)
        method = request.method
        start = time.perf_counter()
        status_code = "500"

        HTTP_REQUESTS_IN_PROGRESS.labels(method=method, path=path).inc()
        try:
            response = await call_next(request)
            status_code = str(response.status_code)
            return response
        finally:
            elapsed = max(0.0, time.perf_counter() - start)
            HTTP_REQUEST_DURATION_SECONDS.labels(method=method, path=path).observe(elapsed)
            HTTP_REQUESTS_TOTAL.labels(method=method, path=path, status=status_code).inc()
            HTTP_REQUESTS_IN_PROGRESS.labels(method=method, path=path).dec()


def configure_monitoring(version: str) -> None:
    APP_INFO.labels(service="blackhole-backend", version=version).set(1)


def metrics_response() -> Response:
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
