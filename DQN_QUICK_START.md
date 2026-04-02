# DQN Agent Quick Start Guide

## How to Use the DQN Learning Agent

### Step 1: Start the Development Server
```bash
npm run dev
```

### Step 2: Enable Agent Control
1. Open the application in your browser
2. In the **Control Panel** (right side), find "Automatic Agent Control"
3. Toggle the switch to **ON**

### Step 3: Enable DQN Learning Mode
1. Once agent control is enabled, you'll see "DQN Learning Mode" toggle appear
2. Toggle it to **ON** to switch from rule-based to DQN learning

### Step 4: Start the Simulation
1. Click the **Start** button
2. Watch the traffic simulation run
3. The DQN agent will:
   - Observe noisy traffic metrics
   - Select actions using epsilon-greedy policy
   - Store experiences in replay buffer
   - Train on batches of experiences
   - Update Q-values over time

### Step 5: Monitor Learning Progress

Watch the **Learning Metrics** panel that appears when DQN mode is active:

- **Epsilon (ε)**: Exploration rate (1.0 → 0.1)
  - High ε = more random exploration
  - Low ε = more exploitation of learned policy

- **Training Steps**: Number of training iterations
  - Increases continuously as agent learns

- **Experiences**: Number of stored experiences
  - Grows to 10,000 then stabilizes

- **Loss**: Training loss (MSE)
  - Should generally decrease as learning progresses

### Step 6: Observe Traffic Performance

Monitor the **Metrics Display** panel:
- Queue lengths per direction
- Average waiting times
- Flow rates
- Reward values (in browser console)

### Comparing Rule-Based vs DQN

**Test Rule-Based Agent:**
1. Enable "Automatic Agent Control"
2. Keep "DQN Learning Mode" OFF
3. Run for 5-10 minutes
4. Note average metrics

**Test DQN Agent:**
1. Reset simulation
2. Enable "Automatic Agent Control"
3. Turn "DQN Learning Mode" ON
4. Run for 5-10 minutes (allow learning time)
5. Compare metrics with rule-based

## Understanding the Learning Process

### Exploration vs Exploitation

**Early Phase (ε ≈ 1.0):**
- Agent explores randomly
- Gathers diverse experiences
- Q-values are unstable

**Learning Phase (ε ≈ 0.5):**
- Balanced exploration/exploitation
- Q-values converging
- Policy improving

**Exploitation Phase (ε ≈ 0.1):**
- Mostly uses learned policy
- Occasional exploration
- Stable performance

### What to Expect

**First 100 Steps:**
- Random behavior (high epsilon)
- Building experience buffer
- High loss values

**Steps 100-500:**
- Learning patterns
- Loss decreasing
- Epsilon decaying

**Steps 500+:**
- More consistent decisions
- Lower epsilon
- Improved traffic flow (if successful)

## Console Logs

Open browser console (F12) to see detailed logs:

```
[DQN] Switched to DQN learning mode
[DQN] Step 50: ε=0.951, Loss=0.0234, Experiences=50
[DQN] Step 100: ε=0.905, Loss=0.0189, Experiences=100
[DQN] Target network updated at step 100
[Reward] Total=-2.345, Congestion=-1.234, Waiting=-0.987, Switch=-0.500, Flow=0.376
```

## Troubleshooting

**Agent not making decisions:**
- Ensure "Automatic Agent Control" is enabled
- Check that simulation is running (not paused)
- Verify signal controller timing constraints

**Loss not decreasing:**
- Normal in early training (high exploration)
- May need more training steps
- Traffic patterns might be too random

**Performance worse than rule-based:**
- DQN needs time to learn (500+ steps)
- Early exploration phase has random actions
- Consider adjusting traffic randomness

## Advanced Configuration

### Adjusting Sensor Noise

Higher noise = harder learning problem:
- Queue Length Noise: ±2 vehicles (default)
- Waiting Time Noise: 15% (default)

### Traffic Patterns

Adjust "Traffic Randomness" slider:
- Low (0.0-0.3): Predictable patterns, easier learning
- Medium (0.4-0.7): Realistic variability
- High (0.8-1.0): Chaotic, harder learning

## Code Integration Points

### DQN Agent Module
```typescript
import { dqnAgent } from '@/corelogic/dqnAgent';

// Select action
const action = dqnAgent.selectAction(observation);

// Store experience
dqnAgent.storeExperience(obs, action, reward, nextObs, done);

// Train
dqnAgent.train();

// Get metrics
const metrics = dqnAgent.getMetrics();
```

### State Representation
```typescript
// 6 features normalized to [0, 1]
const state = [
  ns_queue_normalized,    // 0-1
  ns_wait_normalized,     // 0-1
  ew_queue_normalized,    // 0-1
  ew_wait_normalized,     // 0-1
  ns_speed_feature,       // 0-1
  ew_speed_feature,       // 0-1
];
```

### Actions
```typescript
// 0 = KEEP current signal
// 1 = SWITCH to other signal
type DQNAction = 0 | 1;
```

## Tips for Best Results

1. **Allow Learning Time**: Run for at least 500 training steps
2. **Monitor Epsilon**: Wait until ε < 0.3 for stable policy
3. **Check Console**: Watch reward trends over time
4. **Compare Fairly**: Test both agents under same conditions
5. **Reset Between Tests**: Clear experiences when switching modes

## Success Indicators

✅ Epsilon decaying smoothly (1.0 → 0.1)
✅ Loss decreasing over time
✅ Experience buffer filling up
✅ Consistent action selection (low epsilon)
✅ Improved traffic metrics vs baseline

## Next Steps

After successful DQN training:
1. Compare performance metrics with rule-based agent
2. Test under different traffic patterns
3. Adjust noise levels to test robustness
4. Document learning curves for your report
5. Demonstrate real-time learning in your presentation

---

**Note**: This is a demonstration implementation suitable for a final-year project. The DQN agent learns in real-time during simulation, making it perfect for showing the learning process and comparing with the rule-based baseline.
