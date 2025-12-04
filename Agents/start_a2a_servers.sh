#!/bin/bash
#
# A2A Server Launcher Script
#
# This script starts all OIC AgentOps A2A servers.
# Usage: ./start_a2a_servers.sh [agent_name]
#
# Examples:
#   ./start_a2a_servers.sh           # Start all agents
#   ./start_a2a_servers.sh coordinator  # Start only CoordinatorAgent
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPSTONE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load environment
export PATH="/home/naresh/miniconda3/bin:$PATH"
source "$CAPSTONE_ROOT/.env" 2>/dev/null || true

# Agent ports
declare -A AGENT_PORTS=(
    ["coordinator"]=10001
    ["monitor_errors"]=10002
    ["monitor_queue"]=10003
    ["resubmit_errors"]=10004
    ["recovery_job"]=10005
)

declare -A AGENT_DIRS=(
    ["coordinator"]="CoordinatorAgent"
    ["monitor_errors"]="MonitorErrorsAgent"
    ["monitor_queue"]="MonitorQueueRequestAgent"
    ["resubmit_errors"]="ResubmitErrorsAgent"
    ["recovery_job"]="RecoveryJobAgent"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "================================================================"
echo "  🤖 OIC AgentOps A2A Server Launcher"
echo "================================================================"
echo -e "${NC}"

start_agent() {
    local agent_key=$1
    local port=${AGENT_PORTS[$agent_key]}
    local dir=${AGENT_DIRS[$agent_key]}
    
    if [ -z "$port" ]; then
        echo -e "${RED}❌ Unknown agent: $agent_key${NC}"
        return 1
    fi
    
    echo -e "${GREEN}🚀 Starting $dir on port $port...${NC}"
    
    cd "$SCRIPT_DIR/$dir"
    python a2a_server.py &
    
    echo -e "   ${YELLOW}Card URL: http://localhost:$port/a2a/$dir/.well-known/agent.json${NC}"
}

stop_all() {
    echo -e "\n${YELLOW}🛑 Stopping all A2A servers...${NC}"
    pkill -f "a2a_server.py" 2>/dev/null
    echo -e "${GREEN}✅ All servers stopped${NC}"
}

# Handle Ctrl+C
trap stop_all SIGINT SIGTERM

if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: $0 [agent_name]"
    echo ""
    echo "Available agents:"
    for key in "${!AGENT_DIRS[@]}"; do
        echo "  $key - ${AGENT_DIRS[$key]} (port ${AGENT_PORTS[$key]})"
    done
    exit 0
fi

if [ "$1" == "--list" ] || [ "$1" == "-l" ]; then
    echo -e "${BLUE}📋 Available A2A Agents:${NC}"
    echo "================================================================"
    for key in "${!AGENT_DIRS[@]}"; do
        echo -e "  ${GREEN}$key${NC}:"
        echo "    Name: ${AGENT_DIRS[$key]}"
        echo "    Port: ${AGENT_PORTS[$key]}"
    done
    exit 0
fi

if [ -n "$1" ]; then
    # Start specific agent
    start_agent "$1"
else
    # Start all agents
    for key in "${!AGENT_DIRS[@]}"; do
        start_agent "$key"
        sleep 1
    done
fi

echo -e "\n${BLUE}================================================================${NC}"
echo -e "${GREEN}✅ A2A Servers Started${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers...${NC}"
echo ""

# Wait for all background processes
wait

