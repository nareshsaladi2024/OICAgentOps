"""
A2A Server for RecoveryJobAgent

This module exposes the RecoveryJobAgent via the A2A (Agent-to-Agent) protocol,
allowing other agents to communicate with it over HTTP.
"""

import os
import sys
from pathlib import Path

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables
from dotenv import load_dotenv
capstone_root = Path(__file__).parent.parent.parent.parent
env_path = capstone_root / '.env'
load_dotenv(dotenv_path=env_path)

# Set service account path
service_account_path = capstone_root / 'service_account.json'
if service_account_path.exists():
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(service_account_path.absolute())

# Import the agent
from agent import root_agent

# Import A2A utilities
try:
    from google.adk.a2a.utils.agent_to_a2a import to_a2a
except ImportError:
    print("Error: google.adk.a2a not available. Please update google-adk package.")
    print("Run: pip install --upgrade google-adk")
    sys.exit(1)

# Port configuration
A2A_PORT = int(os.environ.get("RECOVERY_JOB_A2A_PORT", "10005"))

# Create the A2A application
print(f"🚀 Starting RecoveryJobAgent A2A Server on port {A2A_PORT}")
a2a_app = to_a2a(root_agent, port=A2A_PORT)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(a2a_app, host="0.0.0.0", port=A2A_PORT)

