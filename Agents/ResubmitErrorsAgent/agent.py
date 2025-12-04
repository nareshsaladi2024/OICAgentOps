"""
ResubmitErrorsAgent

Uses Google ADK to create an agent that resubmits errored integration instances
by calling the monitoringResubmitErroredInstances tool from the OIC Monitor MCP server.
"""

from google.adk.agents import Agent
import vertexai
import os
import sys
import requests
import json
import logging
import uuid
from typing import Dict, Any, Optional, List
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
    setup_adk_logging(agent_name="ResubmitErrorsAgent", file_only=True)
except ImportError:
    import logging
    logging.basicConfig(
        level=logging.DEBUG if os.getenv("ADK_LOG_LEVEL", "INFO").upper() == "DEBUG" else logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger("ResubmitErrorsAgent")
    logger.info("Using basic logging (utility.logging_config not available)")


def call_mcp_resubmit_errors(
    environment: str = "qa3",
    instanceIds: Optional[List[str]] = None,
    mcp_server_url: Optional[str] = None
) -> str:
    """
    Call the MCP server's monitoringResubmitErroredInstances tool to resubmit errored instances.
    
    Args:
        environment: OIC environment. Valid values: 'dev', 'qa3', 'prod1', 'prod3'. Default: 'qa3'
        instanceIds: List of instance IDs to resubmit. If None, reads from shared state.
        mcp_server_url: URL of the MCP server (optional, uses MCP_SERVER_URL env var)
    
    Returns:
        JSON string with the result of the resubmission including recovery job IDs.
    """
    # Try to load from shared state if no IDs provided
    if not instanceIds:
        try:
            shared_state_path = Path(__file__).parent.parent / 'shared_state.json'
            if shared_state_path.exists():
                with open(shared_state_path, 'r') as f:
                    state = json.load(f)
                    instanceIds = state.get("last_errored_instance_ids", [])
                    # Use environment from state if not specified
                    if environment == "qa3" and "environment" in state:
                        environment = state["environment"]
        except Exception:
            pass
            
    if not instanceIds:
        return json.dumps({
            "isError": True,
            "error": "No instance IDs provided and no recent errors found in shared state. Run MonitorErrorsAgent first."
        }, indent=2)

    if not mcp_server_url:
        mcp_server_url = os.environ.get("MCP_SERVER_URL", "http://localhost:3000")
    
    stream_endpoint = f"{mcp_server_url}/stream"
    request_id = str(uuid.uuid4())
    
    mcp_message = {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "tools/call",
        "params": {
            "name": "monitoringResubmitErroredInstances",
            "arguments": {
                "environment": environment,
                "instanceIds": instanceIds
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
                                # Save recovery job ID to shared state (bulk API response format)
                                try:
                                    data = json.loads(text_content)
                                    recovery_job_id = data.get("recoveryJobId")
                                    
                                    if recovery_job_id:
                                        shared_state_path = Path(__file__).parent.parent / 'shared_state.json'
                                        state = {}
                                        if shared_state_path.exists():
                                            try:
                                                with open(shared_state_path, 'r') as f:
                                                    state = json.load(f)
                                            except:
                                                pass
                                        state["last_recovery_job_ids"] = [recovery_job_id]
                                        state["resubmit_result"] = {
                                            "acceptedIds": data.get("acceptedIds", []),
                                            "recoveryJobId": recovery_job_id,
                                            "resubmitRequested": data.get("resubmitRequested", False),
                                            "resubmittedInstancesCount": data.get("resubmittedInstancesCount", 0),
                                        }
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
    name="ResubmitErrorsAgent",
    model=AGENT_MODEL,
    description="OIC Resubmit Errors Agent responsible for resubmitting errored integration instances.",
    instruction="""
    You are an OIC Resubmit Errors Agent responsible for bulk resubmitting errored integration instances.
    
    When users ask to resubmit errored instances:
    
    1. Call call_mcp_resubmit_errors with:
       - environment: The OIC environment ('dev', 'qa3', 'prod1', 'prod3')
       - instanceIds: List of instance IDs (max 50 per request, or leave empty to use shared state)
    
    2. The bulk resubmit API returns:
       - acceptedIds: List of instance IDs that were accepted
       - recoveryJobId: The recovery job ID for tracking progress
       - resubmitRequested: Boolean indicating request was accepted
       - resubmittedInstancesCount: Number of instances resubmitted
       - resubmittedFailedInstances: List of any failed instances
    
    3. Return results in a clean, structured text format:
       
       **Bulk Resubmission Result:**
       - Environment: [environment]
       - Accepted IDs: [count]
       - Recovery Job ID: [recoveryJobId]
       - Resubmitted Count: [resubmittedInstancesCount]
       - Failed Instances: [list or "None"]
       
    4. If resubmission fails, report the error clearly.
    
    If any MCP tool call returns an error, return the exact error message to the user.
    
    Always present results in plain text format - NOT HTML tables.
    """,
    tools=[call_mcp_resubmit_errors, check_mcp_server_health]
)


if __name__ == "__main__":
    print("ResubmitErrorsAgent")
    print("=" * 50)
    health = check_mcp_server_health()
    print(f"Status: {health.get('status')}")
    if health.get('error_message'):
        print(f"Error: {health.get('error_message')}")
