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

# Load environment variables from Capstone root (central location)
capstone_root = Path(__file__).parent.parent.parent.parent  # Go up to Capstone folder
env_path = capstone_root / '.env'
load_dotenv(dotenv_path=env_path)

# Use service_account.json from Capstone root (central location)
service_account_path = capstone_root / 'service_account.json'
if service_account_path.exists():
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(service_account_path.absolute())

# Initialize Vertex AI with credentials from environment variables
vertexai.init(
    project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
    location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
)

# Configure ADK logging
try:
    parent_dir = Path(__file__).parent.parent.parent
    sys.path.insert(0, str(parent_dir))
    from utility.logging_config import setup_adk_logging, ensure_debug_logging
    setup_adk_logging(agent_name="MonitorErrorsAgent", file_only=True)
except ImportError:
    import logging
    logging.basicConfig(
        level=logging.DEBUG if os.getenv("ADK_LOG_LEVEL", "INFO").upper() == "DEBUG" else logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger("MonitorErrorsAgent")
    logger.info("Using basic logging (utility.logging_config not available)")


def call_mcp_monitoring_errored_instances(
    environment: str = "qa3",
    duration: str = "1h",
    mcp_server_url: Optional[str] = None
) -> str:
    """
    Call the MCP server's monitoringErroredInstances tool to retrieve errored integration instances.
    
    Args:
        environment: OIC environment to query. Valid values: 'dev', 'qa3', 'prod1', 'prod3'. Default: 'qa3'
        duration: Time window. Valid values: '1h', '6h', '1d', '2d', '3d'. Default: '1h'
        mcp_server_url: URL of the MCP server (optional, uses MCP_SERVER_URL env var)
    
    Returns:
        JSON string with errored integration instances information
    """
    if not mcp_server_url:
        mcp_server_url = os.environ.get("MCP_SERVER_URL", "http://localhost:3000")
    
    stream_endpoint = f"{mcp_server_url}/stream"
    request_id = str(uuid.uuid4())
    
    mcp_message = {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "tools/call",
        "params": {
            "name": "monitoringErroredInstances",
            "arguments": {
                "environment": environment,
                "duration": duration
            }
        }
    }
    
    try:
        response = requests.post(
            stream_endpoint,
            json=mcp_message,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream"
            },
            stream=False,
            timeout=60
        )
        
        response.raise_for_status()
        
        content_type = response.headers.get("Content-Type", "")
        
        if "application/json" in content_type:
            try:
                result = response.json()
                if isinstance(result, dict):
                    if "result" in result:
                        content = result["result"].get("content", [])
                        for item in content:
                            if item.get("type") == "text":
                                text_content = item.get("text", "{}")
                                # Save instance IDs to shared state for other agents
                                try:
                                    data = json.loads(text_content)
                                    instance_ids = []
                                    items = data.get("items", [])
                                    for inst in items:
                                        if "id" in inst:
                                            instance_ids.append(inst["id"])
                                        elif "instanceId" in inst:
                                            instance_ids.append(inst["instanceId"])
                                    
                                    if instance_ids:
                                        shared_state_path = Path(__file__).parent.parent / 'shared_state.json'
                                        state = {}
                                        if shared_state_path.exists():
                                            try:
                                                with open(shared_state_path, 'r') as f:
                                                    state = json.load(f)
                                            except:
                                                pass
                                        state["last_errored_instance_ids"] = instance_ids
                                        state["environment"] = environment
                                        with open(shared_state_path, 'w') as f:
                                            json.dump(state, f, indent=2)
                                except:
                                    pass
                                return text_content
                return json.dumps(result, indent=2)
            except ValueError:
                return json.dumps({"raw": response.text})
        else:
            return json.dumps({"raw": response.text})
            
    except requests.exceptions.ConnectionError:
        return json.dumps({
            "isError": True,
            "error": f"Cannot connect to OIC Monitor MCP server at {mcp_server_url}. Make sure the server is running."
        }, indent=2)
    except Exception as e:
        return json.dumps({
            "isError": True,
            "error": f"Error calling MCP server: {str(e)}"
        }, indent=2)


def check_mcp_server_health(mcp_server_url: Optional[str] = None) -> Dict[str, Any]:
    """Check if the OIC Monitor MCP server is running and healthy."""
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
AGENT_MODEL = os.environ.get("AGENT_MODEL", "gemini-2.0-flash")

# Create the AI Agent using Google ADK
root_agent = Agent(
    name="MonitorErrorsAgent",
    model=AGENT_MODEL,
    description="OIC Monitoring Error Agent responsible for retrieving errored integration instances.",
    instruction="""
    You are an OIC Monitoring Error Agent responsible for retrieving errored integration instances.
    
    When users ask for errored instances:
    
    1. Call call_mcp_monitoring_errored_instances with:
       - environment: The OIC environment (e.g., 'qa3', 'dev', 'prod1', 'prod3')
       - duration: Time window (default '1h')
    
    2. Return results in a clean, structured text format:
       
       **Total errored instances: X**
       
       **Instance 1:**
       - ID: [instanceId]
       - Integration: [integration name]
       - Created: [creationDate]
       - Error: [error message, max 100 chars]
       - Recoverable: Yes/No
       
    3. If no errors found, state: "No errored instances found in [environment] for the last [duration]."
    
    If any MCP tool call returns an error, return the exact error message to the user.
    
    Always present results in plain text format - NOT HTML tables.
    """,
    tools=[call_mcp_monitoring_errored_instances, check_mcp_server_health]
)


if __name__ == "__main__":
    print("MonitorErrorsAgent")
    print("=" * 50)
    health = check_mcp_server_health()
    print(f"Status: {health.get('status')}")
    if health.get('error_message'):
        print(f"Error: {health.get('error_message')}")
