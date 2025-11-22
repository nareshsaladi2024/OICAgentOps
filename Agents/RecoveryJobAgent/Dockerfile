# Dockerfile for MonitorQueueRequestAgent
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY agent.py .
COPY test-agent.py .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV GOOGLE_CLOUD_PROJECT=""
ENV GOOGLE_CLOUD_LOCATION="us-central1"
ENV MCP_SERVER_URL="http://localhost:3000"
ENV AGENT_MODEL="gemini-2.5-flash-lite"

# Expose port for ADK web interface (if needed)
EXPOSE 8000

# Run the agent
CMD ["python", "agent.py"]

