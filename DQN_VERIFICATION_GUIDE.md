# DQN Learning Verification & Demonstration Guide

This guide describes how to verify that the DQN agent is learning and how to observe its behavior during a live demonstration.

## 1. How to Verify Learning is Active

### Terminal/Console Logs
Open the browser developer tools (F12) and check the **Console** tab. You will see two types of logs:

1. **[DQN Decision]**: Every 1 second, the agent logs its predicted Q-values.
   - `Q(KEEP)`: Estimated future reward for maintaining the current phase.
   - `Q(SWITCH)`: Estimated future reward for changing the phase.
   - `Mode=EXPLORE`: The agent chose a random action to discover new strategies.
   - `Mode=EXPLOIT`: The agent chose the action with the highest predicted Q-value.

2. **[DQN Training]**: Every 10 training steps (batches), the agent logs training metrics.
   - `Loss`: Indicates how well the network is predicting the targets. It should generally decrease over time, though it may fluctuate during exploration.
   - `AvgQ`: The average predicted reward. This should eventually stabilize or trend upwards as the agent finds better policies.
   - `Target network updated`: Every 50 steps, the agent copies weights to the target network to stabilize learning.

### Q-Value Monitor (UI)
The **Q-Value Monitor** panel on the right side provides a live visualization:
- **Bars**: Graphically show the relative strength of Q(KEEP) vs Q(SWITCH).
- **Trend**: Displays the average Q-value over the last 10 decisions.
- **Weights Change**: As training progresses, you will see the Q-values for the same traffic states change, indicating that the neural network weights are being updated.

## 2. Accelerated Parameters for Demo
To make learning visible quickly (within 2–5 minutes), the following parameters have been tuned:

- **Learning Rate (0.005)**: Higher rate means weights update faster in response to rewards.
- **Epsilon Decay (0.98)**: The agent transitions from random exploration to learned behavior faster (approx. 50-100 decisions to reach 10% overlap).
- **Target Update Frequency (50 steps)**: Faster updates to the target network help the agent adapt to its own discoveries quickly.

## 3. How to Demonstrate "Success"

### Step-by-Step Demo Flow
1. **Start Pure Random**: When ε (epsilon) is near 1.0, show that the agent switches signals semi-randomly, often making poor choices (e.g., switching when many cars are arriving).
2. **Observe Learning**: High loss and shifting Q-values in the monitor show the network is being "punished" for bad choices and "rewarded" for good ones.
3. **Reach Exploitation**: Once ε drops below 0.3, the agent will mostly use its learned behavior.
4. **Compare Actions**: 
   - Point to the **Q-Value Monitor**. 
   - Show a situation where one lane is backed up.
   - Observe that `Q(SWITCH)` becomes significantly higher than `Q(KEEP)`.
   - Verify the agent selects `SWITCH` and the label marks it as `🎯 EXPLOIT` (based on learned values).

## 4. Confirmation of Influence
To prove the agent is using its brain and not a fixed timer:
- **Vary Traffic**: Use the "Traffic Randomness" or lane configurations to create a backlog in one direction.
- **Observation**: Watch the Q-values react. Often, `Q(KEEP)` will drop sharply as the wait time penalty grows in the active direction, forcing a learned `SWITCH`.
- **Contrast**: If you toggle DQN Mode OFF, you go back to the rule-based logic. Notice how the Q-Value Monitor disappears and the behavior reverts to the hardcoded heuristic.

## Expected Timeline (at 1 decision/sec)
- **0-30s**: Pure exploration. Buffer is filling up. No training logs yet.
- **30-90s**: Exploration decaying. Buffer > 32. Training logs appear. Q-values start moving from near-zero.
- **90-180s**: Transition to learned policy. Epsilon < 0.2. Agent starts making "smart" switches consistently. Loss stabilizes.
- **3min+**: Refinement. Agent fine-tunes the timing within the 5-15s window to maximize throughput.
