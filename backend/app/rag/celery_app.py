from app.config import settings

try:
    from celery import Celery
    celery_app = Celery("insight_ai", broker=settings.redis_url, backend=settings.redis_url)
    celery_app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        task_track_started=True,
        result_expires=3600,
        timezone="UTC",
        enable_utc=True,
    )
except ImportError:  # Allows local API development before optional worker dependencies are installed.
    class _UnavailableCelery:
        def task(self, name=None):
            def decorate(function):
                def unavailable_delay(*args, **kwargs):
                    raise RuntimeError("Celery is not installed. Install backend requirements and start Redis + the worker.")
                function.delay = unavailable_delay
                return function
            return decorate

        def AsyncResult(self, job_id):
            class Result:
                state = "FAILURE"
                result = "Celery is not installed. Install backend requirements and start Redis + the worker."
            return Result()

    celery_app = _UnavailableCelery()
