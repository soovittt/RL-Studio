#!/usr/bin/env python3
"""
Test script for RL Studio Backend API
Tests rollout and training endpoints
"""
import requests
import json
import sys

BASE_URL = "http://localhost:8000"

# Sample EnvSpec
SAMPLE_ENV_SPEC = {
    "id": "test_env",
    "name": "Test Grid Environment",
    "envType": "grid",
    "world": {
        "coordinateSystem": "grid",
        "width": 10,
        "height": 10,
        "cellSize": 1.0,
        "physics": {
            "enabled": False,
            "collisionEnabled": True
        }
    },
    "objects": [
        {
            "id": "goal1",
            "type": "goal",
            "position": [9, 9],
            "rotation": 0,
            "size": {"type": "point"},
            "properties": {}
        }
    ],
    "agents": [
        {
            "id": "agent1",
            "name": "Agent",
            "position": [0, 0],
            "rotation": 0,
            "dynamics": {"type": "grid-step"}
        }
    ],
    "actionSpace": {
        "type": "discrete",
        "actions": ["up", "down", "left", "right"]
    },
    "stateSpace": {
        "type": "vector",
        "dimensions": [2]
    },
    "rules": {
        "rewards": [
            {
                "id": "goal_reward",
                "condition": {
                    "type": "agent_at_object",
                    "agentId": "agent1",
                    "objectId": "goal1"
                },
                "reward": 10.0,
                "shaping": False
            }
        ],
        "terminations": [
            {
                "id": "timeout",
                "condition": {
                    "type": "timeout",
                    "steps": 100
                }
            }
        ],
        "events": []
    },
    "visuals": {
        "renderer": "grid"
    },
    "metadata": {
        "tags": []
    }
}

def test_health():
    """Test health check endpoint"""
    print("🏥 Testing health check...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Health check passed:", response.json())
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_rollout_http():
    """Test HTTP rollout endpoint"""
    print("\n🔄 Testing HTTP rollout...")
    try:
        response = requests.post(
            f"{BASE_URL}/api/rollout",
            json={
                "envSpec": SAMPLE_ENV_SPEC,
                "policy": "random",
                "maxSteps": 20,
                "stream": False
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                result = data.get("result", {})
                print(f"✅ Rollout completed:")
                print(f"   - Total reward: {result.get('totalReward', 0):.2f}")
                print(f"   - Episode length: {result.get('episodeLength', 0)}")
                print(f"   - Success: {result.get('success', False)}")
                print(f"   - Steps: {len(result.get('steps', []))}")
                print(f"   - Execution time: {data.get('executionTime', 0):.3f}s")
                return True
            else:
                print(f"❌ Rollout failed: {data.get('error')}")
                return False
        else:
            print(f"❌ HTTP error: {response.status_code}")
            print(response.text)
            return False
    except Exception as e:
        print(f"❌ Rollout error: {e}")
        return False

def main():
    print("🧪 RL Studio Rollout Service Test Suite\n")
    
    # Test health
    if not test_health():
        print("\n❌ Service is not running. Start it with:")
        print("   cd backend && ./start_rollout_service.sh")
        sys.exit(1)
    
    # Test HTTP rollout
    if not test_rollout_http():
        print("\n❌ HTTP rollout test failed")
        sys.exit(1)
    
    print("\n✅ All tests passed!")

if __name__ == "__main__":
    main()

