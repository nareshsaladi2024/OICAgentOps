"""
CoordinatorAgent

Uses Google ADK to create a coordinator agent that orchestrates the OIC error monitoring and recovery workflow.
It coordinates MonitorErrorsAgent, ResubmitErrorsAgent, and RecoveryJobAgent using shared state.
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
    setup_adk_logging(agent_name="CoordinatorAgent", file_only=True)
except ImportError:
    import logging
    logging.basicConfig(
        level=logging.DEBUG if os.getenv("ADK_LOG_LEVEL", "INFO").upper() == "DEBUG" else logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger("CoordinatorAgent")
    logger.info("Using basic logging (utility.logging_config not available)")


# --- Helper Functions ---

def get_shared_state() -> Dict[str, Any]:
    """Read the shared state file."""
    shared_state_path = Path(__file__).parent.parent / 'shared_state.json'
    try:
        if shared_state_path.exists():
            with open(shared_state_path, 'r') as f:
                return json.load(f)
    except:
        pass
    return {}


def update_shared_state(updates: Dict[str, Any]) -> None:
    """Update the shared state file."""
    shared_state_path = Path(__file__).parent.parent / 'shared_state.json'
    state = get_shared_state()
    state.update(updates)
    try:
        with open(shared_state_path, 'w') as f:
            json.dump(state, f, indent=2)
    except:
        pass


def _send_mcp_request(endpoint: str, mcp_message: Dict[str, Any]) -> Dict[str, Any]:
    """Send MCP request and return parsed response."""
    try:
        response = requests.post(
            endpoint,
            json=mcp_message,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream"
            },
            stream=False,
            timeout=60
        )
        response.raise_for_status()
        
        result = response.json()
        if "result" in result and "content" in result["result"]:
            for item in result["result"]["content"]:
                if item.get("type") == "text":
                    try:
                        return json.loads(item.get("text", "{}"))
                    except:
                        return {"raw": item.get("text")}
        return result
        
    except requests.exceptions.ConnectionError:
        return {"isError": True, "error": f"Cannot connect to MCP server at {endpoint}"}
    except Exception as e:
        return {"isError": True, "error": str(e)}


# --- Tool Definitions ---

def monitor_errors(
    environment: str = "qa3",
    duration: str = "1h",
    mcp_server_url: Optional[str] = None
) -> str:
    """
    Monitor and retrieve errored integration instances from OIC.
    
    Args:
        environment: OIC environment (dev, qa3, prod1, prod3). Default: qa3
        duration: Time window (1h, 6h, 1d, 2d, 3d). Default: 1h
        mcp_server_url: MCP server URL (optional)
    
    Returns:
        JSON string with errored instances and count. Instance IDs are saved to shared state.
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
    
    result = _send_mcp_request(stream_endpoint, mcp_message)
    
    # Extract and save instance IDs to shared state
    if not result.get("isError"):
        instance_ids = []
        items = result.get("items", [])
        for item in items:
            if "id" in item:
                instance_ids.append(item["id"])
            elif "instanceId" in item:
                instance_ids.append(item["instanceId"])
        
        update_shared_state({
            "last_errored_instance_ids": instance_ids,
            "environment": environment,
            "error_count": len(instance_ids)
        })
    
    return json.dumps(result, indent=2)


def resubmit_errors(
    environment: str = "qa3",
    instanceIds: Optional[List[str]] = None,
    mcp_server_url: Optional[str] = None
) -> str:
    """
    Resubmit errored integration instances for recovery.
    
    Args:
        environment: OIC environment (dev, qa3, prod1, prod3). Default: qa3
        instanceIds: List of instance IDs. If empty, uses IDs from shared state.
        mcp_server_url: MCP server URL (optional)
    
    Returns:
        JSON string with resubmission result and recovery job IDs.
    """
    # Load from shared state if no IDs provided
    if not instanceIds:
        state = get_shared_state()
        instanceIds = state.get("last_errored_instance_ids", [])
        if not environment or environment == "qa3":
            environment = state.get("environment", "qa3")
    
    if not instanceIds:
        return json.dumps({
            "isError": True,
            "error": "No instance IDs available. Run monitor_errors first."
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
    
    result = _send_mcp_request(stream_endpoint, mcp_message)
    
    # Save resubmit results to shared state
    if not result.get("isError"):
        update_shared_state({
            "resubmit_result": {
                "totalRequested": result.get("totalRequested", 0),
                "successCount": result.get("successCount", 0),
                "failedCount": result.get("failedCount", 0),
                "successInstanceIds": result.get("successInstanceIds", []),
            },
            "environment": environment
        })
    
    return json.dumps(result, indent=2)


def get_recovery_job_status(
    environment: str = "qa3",
    jobId: Optional[str] = None,
    mcp_server_url: Optional[str] = None
) -> str:
    """
    Get the status of a recovery job.
    
    Args:
        environment: OIC environment (dev, qa3, prod1, prod3). Default: qa3
        jobId: Recovery job ID. If empty, uses ID from shared state.
        mcp_server_url: MCP server URL (optional)
    
    Returns:
        JSON string with recovery job details and status.
    """
    # Load from shared state if no job ID provided
    if not jobId:
        state = get_shared_state()
        job_ids = state.get("last_recovery_job_ids", [])
        if job_ids:
            jobId = job_ids[0]
        if not environment or environment == "qa3":
            environment = state.get("environment", "qa3")
    
    if not jobId:
        return json.dumps({
            "isError": True,
            "error": "No job ID available. Run resubmit_errors first."
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
            "name": "monitoringErrorRecoveryJobDetails",
            "arguments": {
                "environment": environment,
                "id": jobId
            }
        }
    }
    
    result = _send_mcp_request(stream_endpoint, mcp_message)
    return json.dumps(result, indent=2)


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

# Create the Coordinator Agent
root_agent = Agent(
    name="CoordinatorAgent",
    model=AGENT_MODEL,
    description="Coordinator Agent for OIC Error Monitoring and Recovery Workflow.",
    instruction="""
    You are the Coordinator Agent responsible for orchestrating the OIC error monitoring and recovery workflow.
    
    **Available Tools:**
    1. monitor_errors - Find errored instances (saves instance IDs to shared state)
    2. resubmit_errors - Resubmit errors for recovery (uses instance IDs from state, saves job IDs)
    3. get_recovery_job_status - Check recovery job status (uses job ID from state)
    4. check_mcp_server_health - Verify MCP server is running
    
    **Workflow for "find errors and resubmit":**
    
    1. Call monitor_errors with environment and duration
       - Returns list of errored instances
       - Automatically saves instance IDs to shared state
       
    2. If errors found, call resubmit_errors with environment
       - Uses instance IDs from shared state automatically
       - Returns recovery job information
       - Saves job IDs to shared state
       
    3. Call get_recovery_job_status to check the recovery job
       - Uses job ID from shared state automatically
       - Returns job status and details
    
    **Output Format (plain text, NOT HTML):**
    
    **Step 1: Monitor Errors**
    - Environment: [qa3]
    - Time Window: [1h]
    - Errors Found: [count]
    - Instance IDs: [id1, id2, ...]
    
    **Step 2: Resubmit Errors**
    - Instances Submitted: [count]
    - Recovery Job ID: [jobId]
    
    **Step 3: Recovery Job Status**
    - Job ID: [jobId]
    - Status: [COMPLETED/IN_PROGRESS/FAILED]
    - Success Count: [X]
    - Failed Count: [Y]
    
    If any MCP tool call returns an error, return the exact error message to the user.
    """,
    tools=[
        monitor_errors,
        resubmit_errors,
        get_recovery_job_status,
        check_mcp_server_health
    ]
)


if __name__ == "__main__":
    print("CoordinatorAgent")
    print("=" * 50)
    health = check_mcp_server_health()
    print(f"Status: {health.get('status')}")
    if health.get('error_message'):
        print(f"Error: {health.get('error_message')}")
