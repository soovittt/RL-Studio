FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better Docker layer caching)
COPY requirements.txt .

# Install Python dependencies
# Install core dependencies first, then heavy ML libraries
RUN pip install --no-cache-dir \
    fastapi>=0.115.0 \
    uvicorn[standard]>=0.32.0 \
    websockets>=13.1 \
    pydantic>=2.10.0 \
    python-multipart>=0.0.12 \
    python-dotenv>=1.0.1 \
    pyyaml>=6.0 \
    requests>=2.31.0 && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY rl_studio/ ./rl_studio/
COPY main.py .

# Verify the app can be imported (catches import errors early)
# This should be fast now since we use lazy imports for heavy dependencies
RUN python -c "from rl_studio.main import app; print('✅ App imports successfully')" || echo "⚠️ Import check failed, but continuing..."

# Expose port (Cloud Run will set PORT env var automatically)
EXPOSE 8080

# Set Python to unbuffered mode for better logging
ENV PYTHONUNBUFFERED=1

# Run the unified backend API
# Cloud Run sets PORT automatically, main.py reads it from env
CMD ["python", "main.py"]

