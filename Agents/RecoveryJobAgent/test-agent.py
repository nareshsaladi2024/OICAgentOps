"""
Test script for MonitorQueueRequestAgent
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import the agent
from agent import root_agent, check_mcp_server_health, call_mcp_monitoring_instances

def test_health_check():
    """Test MCP server health check."""
    print("=" * 60)
    print("Test 1: MCP Server Health Check")
    print("=" * 60)
    health = check_mcp_server_health()
    print(f"Status: {health.get('status')}")
    if health.get('error_message'):
        print(f"Error: {health.get('error_message')}")
    print()
    return health.get('status') == 'healthy'

def test_direct_tool_call():
    """Test direct tool call."""
    print("=" * 60)
    print("Test 2: Direct Tool Call")
    print("=" * 60)
    result = call_mcp_monitoring_instances()
    print(result)
    print()

def test_agent_query():
    """Test agent with natural language query."""
    print("=" * 60)
    print("Test 3: Agent Natural Language Query")
    print("=" * 60)
    query = "What integration instances are currently IN_PROGRESS in the queue?"
    print(f"Query: {query}")
    print()
    try:
        result = root_agent.run(query)
        print("Response:")
        print(result)
    except Exception as e:
        print(f"Error: {e}")
    print()

def main():
    """Run all tests."""
    print("MonitorQueueRequestAgent Test Suite")
    print("=" * 60)
    print()
    
    # Test 1: Health check
    is_healthy = test_health_check()
    
    if is_healthy:
        # Test 2: Direct tool call
        test_direct_tool_call()
        
        # Test 3: Agent query
        test_agent_query()
    else:
        print("⚠️  OIC Monitor MCP server is not running.")
        print("   Please start it before running tests.")
        print()
        print("   To start the server:")
        print("   cd ../../MCPServers/oic-monitor-server")
        print("   node dist/src/index.js")
        print()

if __name__ == "__main__":
    main()

