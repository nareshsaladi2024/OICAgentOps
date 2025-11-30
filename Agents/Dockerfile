# Unified Dockerfile for all OIC Agents
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy root requirements
COPY Agents/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install agent-specific requirements
RUN for dir in CoordinatorAgent MonitorErrorsAgent MonitorQueueRequestAgent RecoveryJobAgent ResubmitErrorsAgent; do \
    if [ -f "$dir/requirements.txt" ]; then \
        pip install --no-cache-dir -r "$dir/requirements.txt"; \
    fi; \
    done

# Copy all agent directories (build context is project root, so use Agents/ prefix)
COPY Agents/CoordinatorAgent/ ./CoordinatorAgent/
COPY Agents/MonitorErrorsAgent/ ./MonitorErrorsAgent/
COPY Agents/MonitorQueueRequestAgent/ ./MonitorQueueRequestAgent/
COPY Agents/RecoveryJobAgent/ ./RecoveryJobAgent/
COPY Agents/ResubmitErrorsAgent/ ./ResubmitErrorsAgent/

# Set environment variables (can be overridden)
ENV PYTHONUNBUFFERED=1
ENV GOOGLE_CLOUD_PROJECT=aiagent-capstoneproject
ENV GOOGLE_CLOUD_LOCATION=us-central1
ENV MCP_SERVER_URL=http://mcp-server:3000
ENV AGENT_MODEL=gemini-2.5-flash-lite
ENV ADK_LOG_LEVEL=DEBUG

# Expose port for ADK web interface
EXPOSE 8000

# Default command (can be overridden in docker-compose)
CMD ["python", "-c", "print('OIC Agents container ready. Use docker-compose to run specific agents.')"]

