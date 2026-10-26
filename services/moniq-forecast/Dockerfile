FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models

WORKDIR /srv

# CPU-only torch. The CPU index serves both linux/amd64 and linux/arm64 wheels.
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

RUN useradd --system --create-home forecast && mkdir -p /models && chown forecast /models
USER forecast

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
