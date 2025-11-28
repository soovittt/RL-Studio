"""
Reward Rule Verification
Detects issues with reward rules: unreachable, contradictory, etc.
"""

from typing import Any, Dict, List

from ..rollout.simulator import (
    create_initial_state,
    select_action,
    step_simulator,
    validate_env_spec,
)


class RewardRuleVerifier:
    """Verifies reward rules for common issues"""

    def verify(self, env_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Verify reward rules and return issues"""
        issues = []
        warnings = []

        # Validate environment first
        validation = validate_env_spec(env_spec)
        if not validation["valid"]:
            return {
                "valid": False,
                "issues": [{"type": "invalid_env", "message": validation["error"]}],
                "warnings": [],
            }

        reward_rules = env_spec.get("rules", {}).get("rewards", [])

        # Check for unreachable rewards
        unreachable = self._check_unreachable_rewards(env_spec, reward_rules)
        issues.extend(unreachable)

        # Check for rules that never fire
        never_fire = self._check_never_fire_rules(env_spec, reward_rules)
        issues.extend(never_fire)

        # Check for contradictory rules
        contradictory = self._check_contradictory_rules(reward_rules)
        issues.extend(contradictory)

        # Check for reward hacking risks
        hacking_risks = self._check_reward_hacking_risks(reward_rules)
        warnings.extend(hacking_risks)

        # Check for overly dense shaping
        dense_shaping = self._check_dense_shaping(reward_rules)
        warnings.extend(dense_shaping)

        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "warnings": warnings,
        }

    def _check_unreachable_rewards(
        self, env_spec: Dict[str, Any], reward_rules: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Check for rewards that are likely unreachable"""
        issues = []

        # Check goal rewards - verify goals are reachable
        goal_rules = [
            r
            for r in reward_rules
            if r.get("condition", {}).get("type") == "goalReached"
        ]
        goals = [o for o in env_spec.get("objects", []) if o.get("type") == "goal"]

        if goal_rules and not goals:
            issues.append(
                {
                    "type": "unreachable_reward",
                    "rule_id": goal_rules[0].get("id", "unknown"),
                    "message": "Goal reward rule exists but no goals in environment",
                }
            )

        # Try to reach goals with greedy policy (simple reachability test)
        if goals:
            state = create_initial_state(env_spec)
            max_test_steps = 100
            reached_goal = False

            for _ in range(max_test_steps):
                if state.get("done"):
                    reached_goal = True
                    break

                action = select_action(state, env_spec, "greedy")
                state = step_simulator(state, action, env_spec)

            if not reached_goal:
                issues.append(
                    {
                        "type": "unreachable_reward",
                        "rule_id": (
                            goal_rules[0].get("id", "unknown")
                            if goal_rules
                            else "unknown"
                        ),
                        "message": "Goals may be unreachable (greedy policy couldn't reach them in 100 steps)",
                    }
                )

        return issues

    def _check_never_fire_rules(
        self, env_spec: Dict[str, Any], reward_rules: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Check for rules that are unlikely to fire"""
        issues = []

        # Run a test rollout to see which rules fire
        state = create_initial_state(env_spec)
        fired_rules = set()
        max_test_steps = 50

        for _ in range(max_test_steps):
            if state.get("done"):
                break

            # Check which reward rules would fire
            rewards = state.get("info", {}).get("rewards", [])
            for reward in rewards:
                rule_id = reward.get("ruleId", "unknown")
                fired_rules.add(rule_id)

            action = select_action(state, env_spec, "random")
            state = step_simulator(state, action, env_spec)

        # Check for rules that never fired
        for rule in reward_rules:
            rule_id = rule.get("id", "unknown")
            if rule_id not in fired_rules:
                issues.append(
                    {
                        "type": "never_fires",
                        "rule_id": rule_id,
                        "message": f"Rule '{rule_id}' did not fire in test rollout",
                    }
                )

        return issues

    def _check_contradictory_rules(
        self, reward_rules: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Check for contradictory reward rules"""
        issues = []

        # Group rules by condition type
        condition_groups = {}
        for rule in reward_rules:
            condition_type = rule.get("condition", {}).get("type")
            if condition_type not in condition_groups:
                condition_groups[condition_type] = []
            condition_groups[condition_type].append(rule)

        # Check for conflicting rewards on same condition
        for condition_type, rules in condition_groups.items():
            if len(rules) > 1:
                # Check if rewards have opposite signs
                positive_rewards = [r for r in rules if r.get("reward", 0) > 0]
                negative_rewards = [r for r in rules if r.get("reward", 0) < 0]

                if positive_rewards and negative_rewards:
                    issues.append(
                        {
                            "type": "contradictory",
                            "condition_type": condition_type,
                            "message": f"Conflicting rewards for condition '{condition_type}': both positive and negative rewards",
                            "rules": [r.get("id") for r in rules],
                        }
                    )

        return issues

    def _check_reward_hacking_risks(
        self, reward_rules: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Check for reward hacking risks"""
        warnings = []

        # Check for per-step rewards that are too high
        per_step_rules = [
            r for r in reward_rules if r.get("condition", {}).get("type") == "perStep"
        ]
        for rule in per_step_rules:
            reward_value = rule.get("reward", 0)
            if abs(reward_value) > 1.0:
                warnings.append(
                    {
                        "type": "reward_hacking_risk",
                        "rule_id": rule.get("id", "unknown"),
                        "message": f"Large per-step reward ({reward_value}) may encourage reward hacking",
                    }
                )

        # Check for rules that reward staying in place
        stay_rules = [
            r for r in reward_rules if "stay" in str(r.get("condition", {})).lower()
        ]
        if stay_rules:
            warnings.append(
                {
                    "type": "reward_hacking_risk",
                    "message": "Rewards for staying in place may encourage agent to not move",
                }
            )

        return warnings

    def _check_dense_shaping(
        self, reward_rules: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Check for overly dense reward shaping"""
        warnings = []

        # Count shaping rewards (non-terminal rewards)
        terminal_types = ["goalReached", "trapHit", "timeout"]
        shaping_rules = [
            r
            for r in reward_rules
            if r.get("condition", {}).get("type") not in terminal_types
        ]

        if len(shaping_rules) > 10:
            warnings.append(
                {
                    "type": "dense_shaping",
                    "message": f"Very dense reward shaping ({len(shaping_rules)} shaping rules) may make learning unstable",
                }
            )

        return warnings
