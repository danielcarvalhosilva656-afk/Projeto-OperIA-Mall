FROM python:3.12-slim
WORKDIR /app
ARG WITH_ASR=false
COPY requirements.txt requirements-asr.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
 && if [ "$WITH_ASR" = "true" ]; then pip install --no-cache-dir -r requirements-asr.txt; fi
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
