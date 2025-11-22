"""
MonitorErrorsAgent

Uses Google ADK to create an agent that monitors errored integration instances
by calling the monitoringErroredInstances tool from the OIC Monitor MCP server.
"""

from google.adk.agents import Agent
import vertexai
import os
import sys
import requests
import json
import logging
import uuid
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from pathlib import Path

# Add parent directory to path to import config if available
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

# Load environment variables
# Load environment variables from the same directory as this script
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# Ensure GOOGLE_APPLICATION_CREDENTIALS points to the absolute path if it's a relative path or if service_account.json exists locally
service_account_path = Path(__file__).parent / 'service_account.json'
if service_account_path.exists():
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(service_account_path.absolute())
elif "GOOGLE_APPLICATION_CREDENTIALS" in os.environ:
    # If it's set but might be relative, resolve it relative to the .env file location
    current_creds = Path(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
    if not current_creds.is_absolute():
        # Try resolving relative to the agent directory
        resolved_creds = Path(__file__).parent / current_creds
        if resolved_creds.exists():
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(resolved_creds.absolute())

# Initialize Vertex AI with credentials from environment variables
vertexai.init(
    project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
    location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
)

# Configure ADK logging
# Try to import logging config from utility if available
try:
    parent_dir = Path(__file__).parent.parent.parent
    sys.path.insert(0, str(parent_dir))
    from utility.logging_config import setup_adk_logging, ensure_debug_logging
    # Setup logging - reads ADK_LOG_LEVEL from .env or defaults to DEBUG
    setup_adk_logging(agent_name="MonitorErrorsAgent", file_only=True)
except ImportError:
    # Fallback: Basic logging setup if utility module not available
    import logging
    logging.basicConfig(
        level=logging.DEBUG if os.getenv("ADK_LOG_LEVEL", "INFO").upper() == "DEBUG" else logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger("MonitorErrorsAgent")
    logger.info("Using basic logging (utility.logging_config not available)")


def call_mcp_monitoring_errored_instances(
    q: str = "{timewindow:'1h', recoverable:'true', integration-style:'appdriven', includePurged:'no'}",
    orderBy: str = "lastupdateddate",
    fields: str = "runId",
    return_format: str = "summary",
    mcp_server_url: Optional[str] = None
) -> str:
    """
    Call the MCP server's monitoringErroredInstances tool to retrieve errored integration instances.
    
    This tool queries the OIC Monitor MCP server to get integration instances that are
    currently in ERROR state. The MCP server handles pagination internally.
    
    Args:
        q: Filter query string. Default: {timewindow:'1h', recoverable:'true', integration-style:'appdriven', includePurged:'no'}
        orderBy: Sort order (default: 'lastupdateddate')
        fields: Field selection (default: 'runId')
        return_format: Response format (default: 'summary')
        mcp_server_url: URL of the MCP server (optional, uses MCP_SERVER_URL env var)
    
    Returns:
        JSON string with errored integration instances information (raw response from MCP server)
    """
    if not mcp_server_url:
        mcp_server_url = os.environ.get("MCP_SERVER_URL", "http://localhost:3000")
    
    # Use streaming HTTP transport endpoint
    stream_endpoint = f"{mcp_server_url}/stream"
    
    # MCP protocol message format for calling a tool
    request_id = str(uuid.uuid4())
    
    mcp_message = {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "tools/call",
        "params": {
            "name": "monitoringErroredInstances",
            "arguments": {
                "q": q,
                "orderBy": orderBy,
                "fields": fields,
                "return": return_format
            }
        }
    }
    
    try:
        # Use streaming HTTP POST request
        response = requests.post(
            stream_endpoint,
            json=mcp_message,
            headers={
                "Content-Type": "application/json",
                "Accept": "text/event-stream, application/json"
            },
            stream=True,
            timeout=60
        )
        
        response.raise_for_status()
        
        # Parse streaming response
        # For MCP protocol, responses may come as SSE or JSON
        content_type = response.headers.get("Content-Type", "")
        
        if "text/event-stream" in content_type or "application/json" in content_type:
            # Try to parse as JSON first
            try:
                result = response.json()
                # Extract content from MCP response structure
                if isinstance(result, dict):
                    if "result" in result:
                        content = result["result"].get("content", [])
                        for item in content:
                            if item.get("type") == "text":
                                text_content = item.get("text", "{}")
                                try:
                                    json.loads(text_content)
                                    return text_content
                                except json.JSONDecodeError:
                                    return json.dumps({"raw": text_content})
                    elif "content" in result:
                        for item in result["content"]:
                            if item.get("type") == "text":
                                text_content = item.get("text", "{}")
                                try:
                                    json.loads(text_content)
                                    return text_content
                                except json.JSONDecodeError:
                                    return json.dumps({"raw": text_content})
                # Save instance IDs to shared state for other agents (e.g., ResubmitErrorsAgent)
                try:
                    instance_ids = []
                    if isinstance(result, dict):
                        items = []
                        if "items" in result:
                            items = result["items"]
                        elif "result" in result and "content" in result["result"]:
                            # Handle nested MCP structure if needed, though usually it's flattened by now
                            pass
                        
                        for item in items:
                            if "id" in item:
                                instance_ids.append(item["id"])
                            elif "instanceId" in item:
                                instance_ids.append(item["instanceId"])
                    
                    if instance_ids:
                        shared_state_path = Path(__file__).parent.parent / 'shared_state.json'
                        with open(shared_state_path, 'w') as f:
                            json.dump({"last_errored_instance_ids": instance_ids}, f)
                        # print(f"Saved {len(instance_ids)} instance IDs to shared state.")
                except Exception as e:
                    # print(f"Warning: Failed to save shared state: {e}")
                    pass

                return json.dumps(result, indent=2)
            except ValueError:
                # If not JSON, read as text (SSE format)
                text_response = response.text
                # Try to extract JSON from SSE format
                lines = text_response.split('\n')
                for line in lines:
                    if line.startswith('data: '):
                        try:
                            data = json.loads(line[6:])  # Remove 'data: ' prefix
                            if "result" in data:
                                content = data["result"].get("content", [])
                                for item in content:
                                    if item.get("type") == "text":
                                        return item.get("text", "{}")
                            return json.dumps(data, indent=2)
                        except (json.JSONDecodeError, KeyError):
                            continue
                return json.dumps({"raw": text_response})
        else:
            # Fallback: treat as plain text
            return json.dumps({"raw": response.text})
            
    except requests.exceptions.ConnectionError:
        error_response = {
            "isError": True,
            "error": f"Cannot connect to OIC Monitor MCP server at {mcp_server_url}. Make sure the server is running."
        }
        return json.dumps(error_response, indent=2)
    except Exception as e:
        error_response = {
            "isError": True,
            "error": f"Error calling MCP server: {str(e)}"
        }
        return json.dumps(error_response, indent=2)


def check_mcp_server_health(mcp_server_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Check if the OIC Monitor MCP server is running and healthy.
    
    Args:
        mcp_server_url: URL of the MCP server (optional)
    
    Returns:
        dict: Dictionary containing server health status
    """
    if not mcp_server_url:
        mcp_server_url = os.environ.get("MCP_SERVER_URL", "http://localhost:3000")
    
    health_endpoint = f"{mcp_server_url}/health"
    
    try:
        response = requests.get(health_endpoint, timeout=5)
        response.raise_for_status()
        health_data = response.json()
        
        return {
            "status": "healthy",
            "server_url": mcp_server_url,
            "server_type": "oic-monitor-mcp",
            "health_check": health_data
        }
    except requests.exceptions.ConnectionError:
        return {
            "status": "unhealthy",
            "server_url": mcp_server_url,
            "server_type": "oic-monitor-mcp",
            "error_message": f"Cannot connect to OIC Monitor MCP server at {mcp_server_url}. Make sure the server is running."
        }
    except Exception as e:
        return {
            "status": "error",
            "server_url": mcp_server_url,
            "server_type": "oic-monitor-mcp",
            "error_message": f"Error checking server health: {str(e)}"
        }


# Get agent model from environment or use default
AGENT_MODEL = os.environ.get("AGENT_MODEL", "gemini-2.5-flash-lite")

# Create the AI Agent using Google ADK
root_agent = Agent(
    name="MonitorErrorsAgent",
    model=AGENT_MODEL,
    description="OIC Monitoring Error Agent responsible for retrieving non-recoverable and recoverable errors.",
    instruction="""
    You are an OIC Monitoring Error Agent responsible for retrieving non-recoverable and recoverable errors.
    
    When users ask for any errored instances:
    
    1. Call the call_mcp_monitoring_errored_instances tool to query for OIC errored instances. The MCP server automatically handles pagination internally (starting with offset=0 and limit=50) and returns all matching instances.
    
    2. Construct the query parameters based on the user's request:
       - Default parameters: {timewindow:'1h', integration-style:'appdriven', includePurged:'no'}
       - If the user asks for "recoverable" errors, add recoverable:'true'.
       - If the user asks for "non-recoverable" errors, add recoverable:'false'.
       - If the user doesn't specify, default to recoverable:'true'.
       
       Example query: {timewindow:'1h', recoverable:'true', integration-style:'appdriven', includePurged:'no'}
    
    3. Return details in structured HTML format that is readable:
       - Total count of matching errored instances
       - HTML table with the following columns:
         * creationDate (converted to MST timezone)
         * integration name
         * instanceId
         * error message (shortened if too long)
         * recoverable (Yes/No)
    
    4. Format the HTML table with proper styling for readability (use table tags with headers, borders, and appropriate spacing).
    
    If the OIC Monitor MCP server is not available:
    1. Use the check_mcp_server_health tool to diagnose the issue
    2. Provide helpful guidance on how to start the server
    3. Suggest alternative approaches if possible
    
    Always present the results in clear, structured HTML format for easy reading and analysis.
    """,
    tools=[call_mcp_monitoring_errored_instances, check_mcp_server_health]
)


if __name__ == "__main__":
    # Example usage
    print("MonitorErrorsAgent")
    print("=" * 50)
    print()
    
    # Check server health
    print("Checking OIC Monitor MCP server health...")
    health = check_mcp_server_health()
    print(f"Status: {health.get('status')}")
    if health.get('error_message'):
        print(f"Error: {health.get('error_message')}")
    print()
    
    # Example query
    if health.get("status") == "healthy":
        print("Example: Getting recoverable errored instances...")
        # Use query() instead of run() for ADK agents
        # Note: The exact method depends on the ADK version, checking common patterns
        if hasattr(root_agent, 'query'):
            result = root_agent.query("What recoverable integration instances are currently in ERROR state?")
        else:
            # Fallback to __call__ or similar if query/run aren't available directly
            # For many agent frameworks, the instance itself is callable
            result = root_agent("What recoverable integration instances are currently in ERROR state?")
        print(result)
    else:
        print("⚠️  OIC Monitor MCP server is not running. Please start it with:")
        print("   cd ../../MCPServers/oic-monitor-server")
        print("   node dist/src/index.js")
        print("   or")
        print("   npm start")

