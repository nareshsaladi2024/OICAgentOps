"""
MonitorQueueRequestAgent

Uses Google ADK to create an agent that monitors integration instances in the queue
by calling the monitoringInstances tool from the OIC Monitor MCP server.
"""

from google.adk.agents import Agent
import vertexai
import os
import sys
import requests
import json
import logging
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from pathlib import Path

# Add parent directory to path to import config if available
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

# Load environment variables
load_dotenv()

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
    setup_adk_logging(agent_name="MonitorQueueRequestAgent", file_only=True)
except ImportError:
    # Fallback: Basic logging setup if utility module not available
    import logging
    logging.basicConfig(
        level=logging.DEBUG if os.getenv("ADK_LOG_LEVEL", "INFO").upper() == "DEBUG" else logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger("MonitorQueueRequestAgent")
    logger.info("Using basic logging (utility.logging_config not available)")


def format_structured_response(data: Dict[str, Any]) -> str:
    """Format the MCP tool response as structured text."""
    output = "=" * 80 + "\n"
    output += "MONITOR QUEUE REQUEST - INTEGRATION INSTANCES\n"
    output += "=" * 80 + "\n\n"

    # Check if there's an error
    if data.get("isError", False):
        output += "STATUS: ERROR\n"
        output += "-" * 80 + "\n"
        
        content = data.get("content", [])
        for item in content:
            if item.get("type") == "text":
                output += f"ERROR MESSAGE: {item.get('text', 'Unknown error')}\n"
        output += "\n"
        return output

    # Parse the JSON response from content
    parsed_data = None
    content = data.get("content", [])
    for item in content:
        if item.get("type") == "text":
            try:
                parsed_data = json.loads(item.get("text", "{}"))
            except json.JSONDecodeError:
                output += f"RESPONSE (Raw):\n{item.get('text', '')}\n\n"
                return output

    if not parsed_data:
        output += "STATUS: NO DATA\n"
        output += "-" * 80 + "\n"
        output += "No data returned from the monitoring API.\n\n"
        return output

    # Format structured response
    output += "STATUS: SUCCESS\n"
    output += "-" * 80 + "\n\n"

    # Summary Information
    output += "SUMMARY:\n"
    output += "-" * 80 + "\n"
    if "totalRecords" in parsed_data:
        output += f"Total Records: {parsed_data['totalRecords']}\n"
    if "retrievedRecords" in parsed_data:
        output += f"Retrieved Records: {parsed_data['retrievedRecords']}\n"
    if "timeWindow" in parsed_data:
        output += f"Time Window: {parsed_data['timeWindow']}\n"
    if "hasMore" in parsed_data:
        output += f"Has More: {'Yes' if parsed_data['hasMore'] else 'No'}\n"
    output += "\n"

    # Items/Instances
    items = parsed_data.get("items", [])
    if items and len(items) > 0:
        output += "INTEGRATION INSTANCES:\n"
        output += "-" * 80 + "\n"
        
        for index, instance in enumerate(items, 1):
            output += f"\nInstance #{index}:\n"
            output += "  " + "-" * 78 + "\n"
            
            # Instance ID
            instance_id = instance.get("instance-id") or instance.get("instanceId")
            if instance_id:
                output += f"  Instance ID: {instance_id}\n"
            
            # Run ID
            run_id = instance.get("run-id") or instance.get("runId")
            if run_id:
                output += f"  Run ID: {run_id}\n"
            
            # Integration Information
            integration_name = instance.get("integration-name") or instance.get("integrationName")
            if integration_name:
                output += f"  Integration: {integration_name}\n"
            
            integration_id = instance.get("integration-id") or instance.get("integrationId")
            if integration_id:
                output += f"  Integration ID: {integration_id}\n"
            
            integration_version = instance.get("integration-version") or instance.get("integrationVersion")
            if integration_version:
                output += f"  Version: {integration_version}\n"
            
            # Status
            if instance.get("status"):
                output += f"  Status: {instance['status']}\n"
            
            # Dates
            if instance.get("date"):
                output += f"  Date: {instance['date']}\n"
            
            creation_date = instance.get("creation-date") or instance.get("creationDate")
            if creation_date:
                output += f"  Created: {creation_date}\n"
            
            last_tracked = instance.get("last-tracked-time") or instance.get("lastTrackedTime")
            if last_tracked:
                output += f"  Last Tracked: {last_tracked}\n"
            
            # Duration
            if "duration" in instance:
                duration_ms = instance["duration"]
                duration_sec = duration_ms // 1000
                duration_min = duration_sec // 60
                output += f"  Duration: {duration_ms}ms ({duration_sec}s / {duration_min}m)\n"
            
            # Tracking Variables
            pk_name = instance.get("pk-name") or instance.get("pkName")
            if pk_name:
                pk_value = instance.get("pk-value") or instance.get("pkValue") or "N/A"
                output += f"  Primary Key: {pk_name} = {pk_value}\n"
            
            secondary_name = instance.get("secondary-tracking-name") or instance.get("secondaryTrackingName")
            if secondary_name:
                secondary_value = instance.get("secondary-tracking-value") or instance.get("secondaryTrackingValue") or "N/A"
                output += f"  Secondary Key: {secondary_name} = {secondary_value}\n"
            
            tertiary_name = instance.get("tertiary-tracking-name") or instance.get("tertiaryTrackingName")
            if tertiary_name:
                tertiary_value = instance.get("tertiary-tracking-value") or instance.get("tertiaryTrackingValue") or "N/A"
                output += f"  Tertiary Key: {tertiary_name} = {tertiary_value}\n"
            
            # Project
            project_code = instance.get("project-code") or instance.get("projectCode")
            if project_code:
                output += f"  Project Code: {project_code}\n"
            
            # Error Information
            has_faults = instance.get("has-recoverable-faults") or instance.get("hasRecoverableFaults")
            if has_faults is not None:
                output += f"  Has Recoverable Faults: {has_faults}\n"
        
        output += "\n"
    else:
        output += "INTEGRATION INSTANCES:\n"
        output += "-" * 80 + "\n"
        output += "No instances found matching the criteria.\n\n"

    output += "=" * 80 + "\n"
    output += "END OF REPORT\n"
    output += "=" * 80 + "\n"

    return output


def call_mcp_monitoring_instances(
    q: str = "{timewindow:'1h', status:'IN_PROGRESS', integration-style:'appdriven', includePurged:'yes'}",
    limit: int = 50,
    offset: int = 0,
    orderBy: str = "lastupdateddate",
    fields: str = "runId",
    return_format: str = "summary",
    mcp_server_url: Optional[str] = None
) -> str:
    """
    Call the MCP server's monitoringInstances tool to retrieve integration instances.
    
    This tool queries the OIC Monitor MCP server to get integration instances that are
    currently IN_PROGRESS from the past hour.
    
    Note: This implementation uses HTTP requests. For full MCP protocol support,
    install the MCP Python SDK: pip install mcp
    
    Args:
        q: Filter query string. Default: {timewindow:'1h', status:'IN_PROGRESS', integration-style:'appdriven', includePurged:'yes'}
        limit: Maximum number of items to return (default: 50)
        offset: Starting point for pagination (default: 0)
        orderBy: Sort order (default: 'lastupdateddate')
        fields: Field selection (default: 'runId')
        return_format: Response format (default: 'summary')
        mcp_server_url: URL of the MCP server (optional, uses MCP_SERVER_URL env var)
    
    Returns:
        Structured text response with integration instances information
    """
    if not mcp_server_url:
        mcp_server_url = os.environ.get("MCP_SERVER_URL", "http://localhost:3000")
    
    # Try to use MCP Python SDK if available
    try:
        from mcp import Client
        from mcp.client.sse import sse_client
        import asyncio
        
        async def call_mcp_async():
            async with sse_client(f"{mcp_server_url}/sse") as (read, write):
                async with Client(read, write) as client:
                    await client.initialize()
                    result = await client.call_tool(
                        "monitoringInstances",
                        arguments={
                            "q": q,
                            "limit": limit,
                            "offset": offset,
                            "orderBy": orderBy,
                            "fields": fields,
                            "return": return_format
                        }
                    )
                    return result
        
        result = asyncio.run(call_mcp_async())
        return format_structured_response(result)
        
    except ImportError:
        # Fallback to HTTP if MCP SDK not available
        # Note: This requires the MCP server to expose a REST API wrapper
        # For production, use the MCP Python SDK
        logger = logging.getLogger("MonitorQueueRequestAgent")
        logger.warning("MCP SDK not available, using HTTP fallback. Install with: pip install mcp")
        
        # HTTP fallback - assumes REST wrapper endpoint exists
        tool_endpoint = f"{mcp_server_url}/api/tools/monitoringInstances"
        
        try:
            response = requests.post(
                tool_endpoint,
                json={
                    "arguments": {
                        "q": q,
                        "limit": limit,
                        "offset": offset,
                        "orderBy": orderBy,
                        "fields": fields,
                        "return": return_format
                    }
                },
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            response.raise_for_status()
            result = response.json()
            return format_structured_response(result)
            
        except requests.exceptions.ConnectionError:
            error_response = {
                "content": [{
                    "type": "text",
                    "text": f"Cannot connect to OIC Monitor MCP server at {mcp_server_url}. Make sure the server is running and MCP SDK is installed (pip install mcp)."
                }],
                "isError": True
            }
            return format_structured_response(error_response)
        except Exception as e:
            error_response = {
                "content": [{
                    "type": "text",
                    "text": f"Error calling MCP server: {str(e)}. For full MCP support, install: pip install mcp"
                }],
                "isError": True
            }
            return format_structured_response(error_response)


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
    name="MonitorQueueRequestAgent",
    model=AGENT_MODEL,
    description="An AI agent that monitors integration instances in the queue by retrieving IN_PROGRESS instances from Oracle Integration Cloud. Specializes in querying the OIC Monitor MCP server to get real-time status of integration instances that are currently being processed.",
    instruction="""
    You are a MonitorQueueRequestAgent that specializes in monitoring integration instances in the queue from Oracle Integration Cloud.
    
    The OIC Monitor MCP server provides:
    - Integration instances that are currently IN_PROGRESS
    - Instance details including status, tracking variables, and execution information
    - Real-time monitoring of integration queue status
    
    Your capabilities include:
    1. Retrieving IN_PROGRESS integration instances from the past hour
    2. Filtering by integration style (appdriven/scheduled)
    3. Getting detailed instance information including:
       - Instance IDs and Run IDs
       - Integration names and versions
       - Status and execution dates
       - Tracking variables (primary, secondary, tertiary)
       - Duration and performance metrics
    4. Providing formatted reports of queue status
    
    When users ask about queue status or monitoring:
    1. Use the call_mcp_monitoring_instances tool to query the OIC Monitor MCP server
    2. By default, query for IN_PROGRESS instances from the past hour
    3. Use the query: {timewindow:'1h', status:'IN_PROGRESS', integration-style:'appdriven', includePurged:'yes'}
    4. Present the results in a clear, structured format
    5. Include summary information (total records, time window)
    6. List all instances with their key details
    
    If the OIC Monitor MCP server is not available:
    1. Use the check_mcp_server_health tool to diagnose the issue
    2. Provide helpful guidance on how to start the server
    3. Suggest alternative approaches if possible
    
    Always be helpful, clear, and concise. Format the response as structured text for easy reading.
    """,
    tools=[call_mcp_monitoring_instances, check_mcp_server_health]
)


if __name__ == "__main__":
    # Example usage
    print("MonitorQueueRequestAgent")
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
        print("Example: Getting IN_PROGRESS instances from queue...")
        result = root_agent.run("What integration instances are currently IN_PROGRESS in the queue?")
        print(result)
    else:
        print("⚠️  OIC Monitor MCP server is not running. Please start it with:")
        print("   cd ../../MCPServers/oic-monitor-server")
        print("   node dist/src/index.js")
        print("   or")
        print("   npm start")

