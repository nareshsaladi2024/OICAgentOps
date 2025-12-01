"""
CoordinatorAgent

Uses Google ADK to create a coordinator agent that orchestrates the OIC error monitoring and recovery workflow.
It combines capabilities to monitor errors, resubmit them, and check recovery job status.
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
    setup_adk_logging(agent_name="CoordinatorAgent", file_only=True)
except ImportError:
    # Fallback: Basic logging setup if utility module not available
    import logging
    logging.basicConfig(
        level=logging.DEBUG if os.getenv("ADK_LOG_LEVEL", "INFO").upper() == "DEBUG" else logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger("CoordinatorAgent")
    logger.info("Using basic logging (utility.logging_config not available)")


# --- Tool Definitions ---

def _send_mcp_request(endpoint: str, mcp_message: Dict[str, Any], tool_name: str) -> str:
    """
    Helper to send MCP requests using streamable HTTP transport and handle shared state.
    
    Streamable HTTP transport supports bidirectional communication:
    - POST /stream - Send client-to-server messages (tool calls)
    - GET /stream - Receive server-to-client messages (responses via SSE stream)
    
    For streamable HTTP, we send POST requests and parse JSON responses.
    """
    try:
        # Send POST request to streamable HTTP endpoint
        response = requests.post(
            endpoint,
            json=mcp_message,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream"
            },
            stream=True,
            timeout=60
        )
        response.raise_for_status()
        
        # Parse response - streamable HTTP can return JSON directly or SSE stream
        result_json = None
        content_type = response.headers.get("Content-Type", "").lower()
        
        # Try JSON response first (streamable HTTP with enableJsonResponse: true)
        if "application/json" in content_type:
            try:
                result_json = response.json()
            except ValueError:
                pass
        
        # If not JSON, try parsing SSE stream (fallback for compatibility)
        if not result_json:
            try:
                # For streamable HTTP, responses might come as SSE stream
                text_response = response.text
                
                # Try direct JSON parse first
                try:
                    result_json = json.loads(text_response)
                except ValueError:
                    # Parse SSE format (data: {...})
                    lines = text_response.split('\n')
                    for line in lines:
                        line = line.strip()
                        if line.startswith('data: '):
                            try:
                                data = json.loads(line[6:])
                                # Look for MCP response with result
                                if "result" in data:
                                    result_json = data
                                    break
                                elif "id" in data and data.get("id") == mcp_message.get("id"):
                                    result_json = data
                                    break
                            except (json.JSONDecodeError, KeyError):
                                continue
            except Exception as e:
                # If all parsing fails, return raw response
                pass
        
        # Extract result from MCP response format
        if result_json:
            # MCP response format: {"jsonrpc": "2.0", "id": "...", "result": {...}}
            if "result" in result_json:
                final_result = result_json["result"]
            else:
                final_result = result_json
            
            # Handle shared state updates based on tool name
            _update_shared_state(tool_name, final_result)
            return json.dumps(final_result, indent=2)
        
        # Fallback: return raw response
        return json.dumps({"raw": response.text, "content_type": content_type}, indent=2)
        
    except requests.exceptions.ConnectionError:
        error_response = {
            "isError": True,
            "error": f"Cannot connect to OIC Monitor MCP server at {endpoint.split('/stream')[0]}. Make sure the server is running and accessible."
        }
        return json.dumps(error_response, indent=2)
    except requests.exceptions.Timeout:
        error_response = {
            "isError": True,
            "error": f"Request to MCP server timed out. The server may be slow or unresponsive."
        }
        return json.dumps(error_response, indent=2)
    except Exception as e:
        error_response = {
            "isError": True,
            "error": f"Error calling MCP server: {str(e)}"
        }
        return json.dumps(error_response, indent=2)


def _update_shared_state(tool_name: str, result: Dict[str, Any]):
    """Update shared state file based on tool results."""
    try:
        shared_state_path = Path(__file__).parent.parent / 'shared_state.json'
        state = {}
        if shared_state_path.exists():
            try:
                with open(shared_state_path, 'r') as f:
                    state = json.load(f)
            except json.JSONDecodeError:
                # Handle empty or malformed JSON file
                pass
        
        updated = False
        
        if tool_name == "monitoringErroredInstances":
            instance_ids = []
            # Check for direct items or nested content
            items = result.get("items", [])
            if not items and "result" in result and "content" in result["result"]:
                for content_item in result["result"]["content"]:
                    if content_item.get("type") == "text":
                        try:
                            text_data = json.loads(content_item.get("text", "{}"))
                            if "items" in text_data:
                                items.extend(text_data["items"])
                        except json.JSONDecodeError:
                            pass # Not a JSON string in text content
            
            for item in items:
                if "id" in item:
                    instance_ids.append(item["id"])
                elif "instanceId" in item:
                    instance_ids.append(item["instanceId"])
            
            if instance_ids:
                state["last_errored_instance_ids"] = instance_ids
                updated = True
                
        elif tool_name == "monitoringResubmitErroredInstances":
            job_ids = []
            if "jobId" in result:
                job_ids.append(result["jobId"])
            elif "id" in result:
                job_ids.append(result["id"])
            elif "result" in result and "jobId" in result["result"]: # Handle nested MCP result
                job_ids.append(result["result"]["jobId"])
            elif "items" in result:
                for item in result["items"]:
                    if "jobId" in item: job_ids.append(item["jobId"])
                    elif "id" in item: job_ids.append(item["id"])
            
            if job_ids:
                state["last_recovery_job_ids"] = job_ids
                updated = True
        
        if updated:
            with open(shared_state_path, 'w') as f:
                json.dump(state, f, indent=2)
                
    except Exception as e:
        # print(f"Warning: Failed to update shared state: {e}")
        pass


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
        JSON string with errored integration instances information.
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
    
    return _send_mcp_request(stream_endpoint, mcp_message, "monitoringErroredInstances")


def call_mcp_resubmit_errors(
    instanceIds: Optional[List[str]] = None,
    mcp_server_url: Optional[str] = None
) -> str:
    """
    Call the MCP server's monitoringResubmitErroredInstances tool to resubmit errored instances.
    
    Args:
        instanceIds: List of instance IDs to resubmit. If None, attempts to read from shared state.
        mcp_server_url: URL of the MCP server (optional, uses MCP_SERVER_URL env var)
    
    Returns:
        JSON string with the result of the resubmission.
    """
    # Try to load from shared state if no IDs provided
    if not instanceIds:
        try:
            shared_state_path = Path(__file__).parent.parent / 'shared_state.json'
            if shared_state_path.exists():
                with open(shared_state_path, 'r') as f:
                    state = json.load(f)
                    instanceIds = state.get("last_errored_instance_ids", [])
        except (json.JSONDecodeError, FileNotFoundError):
            pass
            
    if not instanceIds:
        return json.dumps({
            "isError": True,
            "error": "No instance IDs provided and no recent errors found in shared state."
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
                "instanceIds": instanceIds,
                "return": "monitoringui"
            }
        }
    }
    
    return _send_mcp_request(stream_endpoint, mcp_message, "monitoringResubmitErroredInstances")


def call_mcp_recovery_job_details(
    jobId: Optional[str] = None,
    mcp_server_url: Optional[str] = None
) -> str:
    """
    Call the MCP server's monitoringErrorRecoveryJobDetails tool to get job details.
    
    Args:
        jobId: The ID of the recovery job. If None, attempts to read from shared state.
        mcp_server_url: URL of the MCP server (optional, uses MCP_SERVER_URL env var)
    
    Returns:
        JSON string with the job details.
    """
    # Try to load from shared state if no ID provided
    if not jobId:
        try:
            shared_state_path = Path(__file__).parent.parent / 'shared_state.json'
            if shared_state_path.exists():
                with open(shared_state_path, 'r') as f:
                    state = json.load(f)
                    job_ids = state.get("last_recovery_job_ids", [])
                    if job_ids:
                        jobId = job_ids[0] # Use the most recent job ID
        except (json.JSONDecodeError, FileNotFoundError):
            pass
            
    if not jobId:
        return json.dumps({
            "isError": True,
            "error": "No job ID provided and no recent recovery jobs found in shared state."
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
                "id": jobId
            }
        }
    }
    
    return _send_mcp_request(stream_endpoint, mcp_message, "monitoringErrorRecoveryJobDetails")


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
    name="CoordinatorAgent",
    model=AGENT_MODEL,
    description="Coordinator Agent for OIC Error Monitoring and Recovery Workflow.",
    instruction="""
    You are the Coordinator Agent responsible for orchestrating the OIC error monitoring and recovery workflow.
    
    Your capabilities include:
    1. Monitoring errored instances (using call_mcp_monitoring_errored_instances).
    2. Resubmitting errored instances (using call_mcp_resubmit_errors).
    3. Checking the status of recovery jobs (using call_mcp_recovery_job_details).
    
    You can execute these steps sequentially or individually based on user requests.
    
    Workflow for "Fix errors":
    1. Call monitoringErroredInstances to find recoverable errors.
       - Default parameters: {timewindow:'1h', integration-style:'appdriven', includePurged:'no'}
       - If the user asks for "recoverable" errors, add recoverable:'true'.
       - If the user asks for "non-recoverable" errors, add recoverable:'false'.
       - If the user doesn't specify, default to recoverable:'true'.
    2. If errors are found, call monitoringResubmitErroredInstances with the found instance IDs.
    3. If a recovery job is started, call monitoringErrorRecoveryJobDetails to check its status.
    4. Report the final status to the user in a clear, structured HTML format.
    
    Always provide clear, structured HTML output at each step.
    
    If the OIC Monitor MCP server is not available:
    1. Use the check_mcp_server_health tool to diagnose the issue
    2. Provide helpful guidance on how to start the server
    3. Suggest alternative approaches if possible
    """,
    tools=[
        call_mcp_monitoring_errored_instances,
        call_mcp_resubmit_errors,
        call_mcp_recovery_job_details,
        check_mcp_server_health
    ]
)


if __name__ == "__main__":
    # Example usage
    print("CoordinatorAgent")
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
        print("Example: Running full recovery workflow...")
        # Use query() instead of run() for ADK agents
        if hasattr(root_agent, 'query'):
            result = root_agent.query("Find all recoverable errors from the last hour, resubmit them, and tell me the status of the recovery job.")
        else:
            result = root_agent("Find all recoverable errors from the last hour, resubmit them, and tell me the status of the recovery job.")
        print(result)
    else:
        print("⚠️  OIC Monitor MCP server is not running. Please start it with:")
        print("   cd ../../MCPServers/oic-monitor-server")
        print("   node dist/src/index.js")
        print("   or")
        print("   npm start")

