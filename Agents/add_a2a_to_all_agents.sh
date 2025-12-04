#!/bin/bash
#
# Add A2A Support to All Agents
#
# This script adds A2A protocol support to all agents in the Capstone folder
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPSTONE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export PATH="/home/naresh/miniconda3/bin:$PATH"

echo "================================================================"
echo "  🤖 Adding A2A Support to All Agents"
echo "================================================================"

# Port counter
PORT=10001

# Function to add A2A to agent
add_a2a() {
    local agent_path=$1
    local port=$2
    
    if [ -f "$agent_path/agent.py" ]; then
        echo ""
        echo "📦 Processing: $agent_path"
        python "$SCRIPT_DIR/a2a_generator.py" "$agent_path" --port $port --force
    fi
}

# OICAgentOps Agents (already done, skip)
echo ""
echo "✅ OICAgentOps Agents already have A2A support"

# Kaggle Day 1a agents
echo ""
echo "--- Processing Day1a agents ---"
add_a2a "$CAPSTONE_ROOT/kaggle-5-day-agents/Day1a/helpful_assistant" $((PORT++))
add_a2a "$CAPSTONE_ROOT/kaggle-5-day-agents/Day1a/sample-agent" $((PORT++))

# Kaggle Day 1b agents
echo ""
echo "--- Processing Day1b agents ---"
for agent_dir in "$CAPSTONE_ROOT/kaggle-5-day-agents/Day1b/"*/; do
    if [ -f "$agent_dir/agent.py" ]; then
        add_a2a "$agent_dir" $((PORT++))
    fi
done

# Kaggle Day 2a agents
echo ""
echo "--- Processing Day2a agents ---"
add_a2a "$CAPSTONE_ROOT/kaggle-5-day-agents/Day2a/CurrencyAgent" $((PORT++))

# Kaggle Day 2b agents
echo ""
echo "--- Processing Day2b agents ---"
add_a2a "$CAPSTONE_ROOT/kaggle-5-day-agents/Day2b/image_agent" $((PORT++))
add_a2a "$CAPSTONE_ROOT/kaggle-5-day-agents/Day2b/shipping_agent" $((PORT++))

# Kaggle Day 3a agents
echo ""
echo "--- Processing Day3a agents ---"
for agent_dir in "$CAPSTONE_ROOT/kaggle-5-day-agents/Day3a/agents/"*/; do
    if [ -f "$agent_dir/agent.py" ]; then
        add_a2a "$agent_dir" $((PORT++))
    fi
done

# Kaggle Day 5a agents
echo ""
echo "--- Processing Day5a agents ---"
add_a2a "$CAPSTONE_ROOT/kaggle-5-day-agents/Day5a/CustomerSupportAgent" $((PORT++))
add_a2a "$CAPSTONE_ROOT/kaggle-5-day-agents/Day5a/ProductCatalogAgent" $((PORT++))

# Top-level agents folder
echo ""
echo "--- Processing top-level agents ---"
for agent_dir in "$CAPSTONE_ROOT/kaggle-5-day-agents/agents/"*/; do
    if [ -f "$agent_dir/agent.py" ]; then
        add_a2a "$agent_dir" $((PORT++))
    fi
done

echo ""
echo "================================================================"
echo "  ✅ A2A Support Added!"
echo "================================================================"
echo ""
echo "Total ports used: $PORT starting from 10001"
echo ""

