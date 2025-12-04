#!/usr/bin/env python3
"""
A2A Server Launcher

This script starts all OIC AgentOps A2A servers.
Each agent runs on its own port and exposes an A2A-compatible API.

Usage:
    python start_a2a_servers.py [--agent AGENT_NAME] [--port PORT]

Examples:
    python start_a2a_servers.py                      # Start all agents
    python start_a2a_servers.py --agent coordinator  # Start only CoordinatorAgent
    python start_a2a_servers.py --list               # List all available agents
"""

import argparse
import asyncio
import os
import sys
import signal
import subprocess
from pathlib import Path
from typing import Dict, List, Optional

# Agent configurations
AGENTS = {
    "coordinator": {
        "name": "CoordinatorAgent",
        "path": "CoordinatorAgent",
        "port": 10001,
        "description": "Orchestrates OIC error monitoring and recovery workflow"
    },
    "monitor_errors": {
        "name": "MonitorErrorsAgent", 
        "path": "MonitorErrorsAgent",
        "port": 10002,
        "description": "Monitors errored integration instances"
    },
    "monitor_queue": {
        "name": "MonitorQueueRequestAgent",
        "path": "MonitorQueueRequestAgent", 
        "port": 10003,
        "description": "Monitors queue requests pending in OIC"
    },
    "resubmit_errors": {
        "name": "ResubmitErrorsAgent",
        "path": "ResubmitErrorsAgent",
        "port": 10004,
        "description": "Bulk resubmits errored instances"
    },
    "recovery_job": {
        "name": "RecoveryJobAgent",
        "path": "RecoveryJobAgent",
        "port": 10005,
        "description": "Checks recovery job status"
    }
}


def get_agent_dir() -> Path:
    """Get the Agents directory path."""
    return Path(__file__).parent


def list_agents():
    """List all available agents."""
    print("\n📋 Available A2A Agents:")
    print("=" * 60)
    for key, config in AGENTS.items():
        print(f"\n  {key}:")
        print(f"    Name: {config['name']}")
        print(f"    Port: {config['port']}")
        print(f"    Description: {config['description']}")
    print("\n" + "=" * 60)


def start_agent(agent_key: str, port: Optional[int] = None) -> subprocess.Popen:
    """Start a single A2A agent server."""
    config = AGENTS.get(agent_key)
    if not config:
        raise ValueError(f"Unknown agent: {agent_key}")
    
    agent_dir = get_agent_dir() / config["path"]
    a2a_server = agent_dir / "a2a_server.py"
    
    if not a2a_server.exists():
        raise FileNotFoundError(f"A2A server not found: {a2a_server}")
    
    env = os.environ.copy()
    actual_port = port or config["port"]
    env_var = f"{agent_key.upper().replace('_', '_')}_A2A_PORT"
    env[env_var] = str(actual_port)
    
    print(f"🚀 Starting {config['name']} on port {actual_port}...")
    
    process = subprocess.Popen(
        [sys.executable, str(a2a_server)],
        cwd=str(agent_dir),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT
    )
    
    return process


def start_all_agents() -> Dict[str, subprocess.Popen]:
    """Start all A2A agents."""
    processes = {}
    
    print("\n" + "=" * 60)
    print("🤖 OIC AgentOps A2A Server Launcher")
    print("=" * 60)
    
    for agent_key in AGENTS:
        try:
            processes[agent_key] = start_agent(agent_key)
        except Exception as e:
            print(f"❌ Failed to start {agent_key}: {e}")
    
    return processes


def print_status(processes: Dict[str, subprocess.Popen]):
    """Print status of running agents."""
    print("\n" + "=" * 60)
    print("📊 A2A Agent Status")
    print("=" * 60)
    
    for agent_key, process in processes.items():
        config = AGENTS[agent_key]
        status = "✅ Running" if process.poll() is None else "❌ Stopped"
        print(f"  {config['name']}: {status} (port {config['port']})")
        print(f"    Card URL: http://localhost:{config['port']}/a2a/{config['name']}/.well-known/agent.json")
    
    print("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Start A2A Agent Servers")
    parser.add_argument("--agent", "-a", help="Start specific agent (use --list to see options)")
    parser.add_argument("--port", "-p", type=int, help="Override default port")
    parser.add_argument("--list", "-l", action="store_true", help="List available agents")
    
    args = parser.parse_args()
    
    if args.list:
        list_agents()
        return
    
    processes = {}
    
    def signal_handler(sig, frame):
        print("\n\n🛑 Shutting down A2A servers...")
        for name, proc in processes.items():
            if proc.poll() is None:
                proc.terminate()
                print(f"  Stopped {name}")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        if args.agent:
            processes[args.agent] = start_agent(args.agent, args.port)
        else:
            processes = start_all_agents()
        
        import time
        time.sleep(2)  # Wait for servers to start
        
        print_status(processes)
        
        print("\n⏳ Press Ctrl+C to stop all servers...\n")
        
        # Keep running and monitor processes
        while True:
            for name, proc in list(processes.items()):
                if proc.poll() is not None:
                    # Process died, restart it
                    print(f"⚠️  {name} stopped unexpectedly, restarting...")
                    processes[name] = start_agent(name)
            time.sleep(5)
            
    except KeyboardInterrupt:
        signal_handler(None, None)


if __name__ == "__main__":
    main()

