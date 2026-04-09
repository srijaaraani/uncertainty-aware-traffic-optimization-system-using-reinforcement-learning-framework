/**
 * Deep Q-Network (DQN) Agent for Traffic Signal Control
 * 
 * This module implements a learning-based agent using Deep Q-Learning.
 * The agent learns to optimize traffic signal timing by:
 * - Observing noisy traffic metrics from the probabilistic sensor model
 * - Learning Q-values for actions (KEEP or SWITCH signal)
 * - Using experience replay for stable learning
 * - Employing a target network to prevent moving target problem
 * 
 * ARCHITECTURE:
 * - Input: 6 features (NS queue, NS wait, EW queue, EW wait, NS speed, EW speed)
 * - Hidden: 2 layers (64 and 32 neurons) with ReLU activation
 * - Output: 2 Q-values (KEEP, SWITCH)
 * 
 * LEARNING STRATEGY:
 * - Epsilon-greedy exploration (ε: 1.0 → 0.1)
 * - Experience replay buffer (capacity: 10,000)
 * - Target network updated every 100 steps
 * - Batch size: 32, Learning rate: 0.001, Discount: 0.95
 */

import { AgentObservation, AgentAction, SignalPhase } from './agent';

// ============================================
// TYPES AND INTERFACES
// ============================================

/**
 * DQN Action type - maps to agent actions
 * 0 = KEEP current signal phase
 * 1 = SWITCH to other signal phase
 */
export type DQNAction = 0 | 1;

/**
 * Experience tuple for replay buffer
 */
export interface Experience {
    state: number[];
    action: DQNAction;
    reward: number;
    nextState: number[];
    done: boolean;
}

/**
 * DQN configuration parameters
 */
export interface DQNConfig {
    // Network architecture
    inputSize: number;
    hiddenSize1: number;
    hiddenSize2: number;
    outputSize: number;

    // Learning parameters
    learningRate: number;
    discountFactor: number;

    // Exploration parameters
    epsilonStart: number;
    epsilonEnd: number;
    epsilonDecay: number;

    // Experience replay
    replayBufferSize: number;
    batchSize: number;

    // Target network
    targetUpdateFrequency: number;
}

/**
 * Training metrics for monitoring
 */
export interface TrainingMetrics {
    epsilon: number;
    loss: number;
    avgQValue: number;
    experienceCount: number;
    trainingSteps: number;
}

/**
 * Q-value decision details for observability
 */
export interface QValueDecision {
    state: number[];
    qValues: number[];  // [Q(KEEP), Q(SWITCH)]
    selectedAction: DQNAction;
    actionName: string;  // "KEEP" or "SWITCH"
    wasRandom: boolean;  // true if epsilon-greedy exploration
    epsilon: number;
    timestamp: number;
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_CONFIG: DQNConfig = {
    inputSize: 6,
    hiddenSize1: 64,
    hiddenSize2: 32,
    outputSize: 2,
    learningRate: 0.005,
    discountFactor: 0.95,
    // Exploration schedule: starts fully random, visibly converges over ~150 training steps
    // ε=1.0 → 0.15 with decay 0.97 per step:
    //   step 0:   ε ≈ 1.00  (fully random, diverse actions)
    //   step 50:  ε ≈ 0.22  (mostly learned, some exploration)
    //   step 100: ε ≈ 0.17  (mostly exploiting learned policy)
    //   step 150: ε ≈ 0.15  (settled, small residual exploration)
    epsilonStart: 1.0,
    epsilonEnd: 0.15,   // Retain 15% exploration so behaviour never fully deterministic
    epsilonDecay: 0.97, // Decays per training step — visible learning curve in ~100 steps
    replayBufferSize: 10000,
    batchSize: 32,
    targetUpdateFrequency: 50,
};

// ============================================
// NEURAL NETWORK IMPLEMENTATION
// ============================================

/**
 * Simple feedforward neural network for Q-value approximation
 */
class NeuralNetwork {
    private weights1: number[][];
    private bias1: number[];
    private weights2: number[][];
    private bias2: number[];
    private weights3: number[][];
    private bias3: number[];

    constructor(
        inputSize: number,
        hiddenSize1: number,
        hiddenSize2: number,
        outputSize: number
    ) {
        // Initialize weights with Xavier initialization
        this.weights1 = this.initializeWeights(inputSize, hiddenSize1);
        this.bias1 = new Array(hiddenSize1).fill(0);

        this.weights2 = this.initializeWeights(hiddenSize1, hiddenSize2);
        this.bias2 = new Array(hiddenSize2).fill(0);

        this.weights3 = this.initializeWeights(hiddenSize2, outputSize);
        this.bias3 = new Array(outputSize).fill(0);
    }

    /**
     * Xavier initialization for weights
     */
    private initializeWeights(inputSize: number, outputSize: number): number[][] {
        const limit = Math.sqrt(6 / (inputSize + outputSize));
        const weights: number[][] = [];

        for (let i = 0; i < inputSize; i++) {
            weights[i] = [];
            for (let j = 0; j < outputSize; j++) {
                weights[i][j] = (Math.random() * 2 - 1) * limit;
            }
        }

        return weights;
    }

    /**
     * ReLU activation function
     */
    private relu(x: number): number {
        return Math.max(0, x);
    }

    /**
     * Forward pass through the network
     */
    forward(input: number[]): number[] {
        // Layer 1: input -> hidden1
        const hidden1 = new Array(this.weights1[0].length).fill(0);
        for (let j = 0; j < hidden1.length; j++) {
            let sum = this.bias1[j];
            for (let i = 0; i < input.length; i++) {
                sum += input[i] * this.weights1[i][j];
            }
            hidden1[j] = this.relu(sum);
        }

        // Layer 2: hidden1 -> hidden2
        const hidden2 = new Array(this.weights2[0].length).fill(0);
        for (let j = 0; j < hidden2.length; j++) {
            let sum = this.bias2[j];
            for (let i = 0; i < hidden1.length; i++) {
                sum += hidden1[i] * this.weights2[i][j];
            }
            hidden2[j] = this.relu(sum);
        }

        // Layer 3: hidden2 -> output
        const output = new Array(this.weights3[0].length).fill(0);
        for (let j = 0; j < output.length; j++) {
            let sum = this.bias3[j];
            for (let i = 0; i < hidden2.length; i++) {
                sum += hidden2[i] * this.weights3[i][j];
            }
            output[j] = sum; // Linear output for Q-values
        }

        return output;
    }

    /**
     * Copy weights from another network
     */
    copyFrom(other: NeuralNetwork): void {
        this.weights1 = other.weights1.map(row => [...row]);
        this.bias1 = [...other.bias1];
        this.weights2 = other.weights2.map(row => [...row]);
        this.bias2 = [...other.bias2];
        this.weights3 = other.weights3.map(row => [...row]);
        this.bias3 = [...other.bias3];
    }

    /**
     * Update weights using gradient descent (simplified backpropagation)
     */
    updateWeights(
        input: number[],
        targetOutput: number[],
        learningRate: number
    ): number {
        // Forward pass to get activations
        const hidden1 = new Array(this.weights1[0].length).fill(0);
        for (let j = 0; j < hidden1.length; j++) {
            let sum = this.bias1[j];
            for (let i = 0; i < input.length; i++) {
                sum += input[i] * this.weights1[i][j];
            }
            hidden1[j] = this.relu(sum);
        }

        const hidden2 = new Array(this.weights2[0].length).fill(0);
        for (let j = 0; j < hidden2.length; j++) {
            let sum = this.bias2[j];
            for (let i = 0; i < hidden1.length; i++) {
                sum += hidden1[i] * this.weights2[i][j];
            }
            hidden2[j] = this.relu(sum);
        }

        const output = this.forward(input);

        // Calculate loss (MSE)
        let loss = 0;
        const outputGrad = new Array(output.length);
        for (let i = 0; i < output.length; i++) {
            const error = output[i] - targetOutput[i];
            loss += error * error;
            outputGrad[i] = 2 * error;
        }
        loss /= output.length;

        // Simplified gradient descent update (output layer only for efficiency)
        for (let i = 0; i < this.weights3.length; i++) {
            for (let j = 0; j < this.weights3[i].length; j++) {
                this.weights3[i][j] -= learningRate * outputGrad[j] * hidden2[i];
            }
        }
        for (let j = 0; j < this.bias3.length; j++) {
            this.bias3[j] -= learningRate * outputGrad[j];
        }

        return loss;
    }
}

// ============================================
// EXPERIENCE REPLAY BUFFER
// ============================================

/**
 * Circular buffer for storing and sampling experiences
 */
class ReplayBuffer {
    private buffer: Experience[] = [];
    private capacity: number;
    private position: number = 0;

    constructor(capacity: number) {
        this.capacity = capacity;
    }

    /**
     * Add experience to buffer
     */
    push(experience: Experience): void {
        if (this.buffer.length < this.capacity) {
            this.buffer.push(experience);
        } else {
            this.buffer[this.position] = experience;
        }
        this.position = (this.position + 1) % this.capacity;
    }

    /**
     * Sample random batch of experiences
     */
    sample(batchSize: number): Experience[] {
        const batch: Experience[] = [];
        const size = Math.min(batchSize, this.buffer.length);

        for (let i = 0; i < size; i++) {
            const index = Math.floor(Math.random() * this.buffer.length);
            batch.push(this.buffer[index]);
        }

        return batch;
    }

    /**
     * Get current buffer size
     */
    size(): number {
        return this.buffer.length;
    }

    /**
     * Clear all experiences
     */
    clear(): void {
        this.buffer = [];
        this.position = 0;
    }
}

// ============================================
// DQN AGENT
// ============================================

/**
 * Deep Q-Network Agent for traffic signal control
 */
export class DQNAgent {
    private config: DQNConfig;
    private qNetwork: NeuralNetwork;
    private targetNetwork: NeuralNetwork;
    private replayBuffer: ReplayBuffer;

    private epsilon: number;
    private trainingSteps: number = 0;
    private lastLoss: number = 0;
    private lastAvgQValue: number = 0;
    private lastQValueDecision: QValueDecision | null = null;
    private qValueHistory: number[][] = [];  // Track Q-value evolution
    private maxHistorySize: number = 100;

    constructor(config: Partial<DQNConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Initialize networks
        this.qNetwork = new NeuralNetwork(
            this.config.inputSize,
            this.config.hiddenSize1,
            this.config.hiddenSize2,
            this.config.outputSize
        );

        this.targetNetwork = new NeuralNetwork(
            this.config.inputSize,
            this.config.hiddenSize1,
            this.config.hiddenSize2,
            this.config.outputSize
        );

        // Copy initial weights to target network
        this.targetNetwork.copyFrom(this.qNetwork);

        // Initialize replay buffer
        this.replayBuffer = new ReplayBuffer(this.config.replayBufferSize);

        // Initialize exploration rate
        this.epsilon = this.config.epsilonStart;
    }

    /**
     * Convert agent observation to normalized state vector
     */
    private observationToState(observation: AgentObservation): number[] {
        // Normalize features to [0, 1] range
        const maxQueue = 30;
        const maxWaitTime = 60;
        const maxSpeed = 3.0;

        return [
            Math.min(observation.ns.queueLength / maxQueue, 1.0),
            Math.min(observation.ns.avgWaitingTime / maxWaitTime, 1.0),
            Math.min(observation.ew.queueLength / maxQueue, 1.0),
            Math.min(observation.ew.avgWaitingTime / maxWaitTime, 1.0),
            // Speed is inverse (higher is better, so we invert normalization)
            1.0 - Math.min(observation.ns.avgWaitingTime / maxWaitTime, 1.0),
            1.0 - Math.min(observation.ew.avgWaitingTime / maxWaitTime, 1.0),
        ];
    }

    /**
     * Convert DQN action to agent action
     */
    private dqnActionToAgentAction(
        dqnAction: DQNAction,
        currentPhase: SignalPhase
    ): AgentAction {
        if (dqnAction === 0) {
            return 'KEEP';
        } else {
            // Switch to opposite phase
            return currentPhase === 'NS' ? 'EW' : 'NS';
        }
    }

    /**
     * Select action using epsilon-greedy policy with congestion-aware Q-value bias.
     * 
     * CONGESTION BIAS (does NOT override RL):
     * After the network produces raw Q-values, a small positive bias is added to
     * Q(SWITCH) when the waiting direction is significantly more congested than
     * the currently-green direction. This guides early exploration toward
     * meaningful behaviours without forcing deterministic rules.
     * 
     * - Bias only applies when queue difference ≥ 2 vehicles
     * - Bias is capped at 0.3 — a strong learned Q-value preference always wins
     * - During exploration (ε-greedy random), bias plays no role
     * - The final action is still argmax(adjusted Q-values) — purely RL
     */
    selectAction(observation: AgentObservation): AgentAction {
        const state = this.observationToState(observation);
        const qValues = this.qNetwork.forward(state);

        // ── Congestion-difference bias ────────────────────────────────────────
        // Determine which direction is currently green and which is waiting
        const currentPhase = observation.signalPhase; // 'NS' or 'EW'
        const currentQueue = currentPhase === 'NS'
            ? observation.ns.queueLength
            : observation.ew.queueLength;
        const otherQueue = currentPhase === 'NS'
            ? observation.ew.queueLength
            : observation.ns.queueLength;

        const queueDifference = otherQueue - currentQueue; // positive → other is busier

        // Apply a gentle nudge to Q(SWITCH) when the other direction
        // is meaningfully more congested. Bias scales with severity and is capped.
        // MAX_BIAS is small enough that a well-trained Q-value disparity overrides it.
        const BIAS_THRESHOLD = 2;    // minimum queue difference before bias applies
        const BIAS_SCALE    = 0.03;  // bias per additional vehicle in queue
        const MAX_BIAS      = 0.3;   // hard cap so RL always has final say

        const adjustedQValues = [...qValues];
        if (queueDifference >= BIAS_THRESHOLD) {
            const congestionBias = Math.min(
                (queueDifference - BIAS_THRESHOLD) * BIAS_SCALE,
                MAX_BIAS
            );
            adjustedQValues[1] += congestionBias; // nudge Q(SWITCH) upward
        }
        // ─────────────────────────────────────────────────────────────────────

        let selectedDqnAction: DQNAction;
        let wasRandom = false;

        // Epsilon-greedy exploration (uses adjusted Q-values for exploitation)
        if (Math.random() < this.epsilon) {
            // Random action — 50/50 to ensure diverse early experience
            selectedDqnAction = Math.random() < 0.5 ? 0 : 1;
            wasRandom = true;
        } else {
            // Exploitation: pick action with highest adjusted Q-value
            selectedDqnAction = adjustedQValues[0] > adjustedQValues[1] ? 0 : 1;
            wasRandom = false;
        }

        // Store decision details (log raw AND adjusted Q-values for transparency)
        this.lastQValueDecision = {
            state,
            qValues: adjustedQValues, // show adjusted values in UI
            selectedAction: selectedDqnAction,
            actionName: selectedDqnAction === 0 ? 'KEEP' : 'SWITCH',
            wasRandom,
            epsilon: this.epsilon,
            timestamp: Date.now(),
        };

        // Track Q-value evolution
        this.qValueHistory.push([...adjustedQValues]);
        if (this.qValueHistory.length > this.maxHistorySize) {
            this.qValueHistory.shift();
        }

        // Update average Q-value
        this.lastAvgQValue = (adjustedQValues[0] + adjustedQValues[1]) / 2;

        // Log decision with congestion context
        const biasNote = queueDifference >= BIAS_THRESHOLD
            ? ` [bias +${Math.min((queueDifference - BIAS_THRESHOLD) * BIAS_SCALE, MAX_BIAS).toFixed(3)} to SWITCH, ΔQ=${queueDifference}]`
            : '';
        console.log(
            `[DQN] Q(KEEP)=${adjustedQValues[0].toFixed(4)}, Q(SWITCH)=${adjustedQValues[1].toFixed(4)},` +
            ` Action=${this.lastQValueDecision.actionName},` +
            ` Mode=${wasRandom ? 'EXPLORE' : 'EXPLOIT'}, ε=${this.epsilon.toFixed(3)}${biasNote}`
        );

        return this.dqnActionToAgentAction(selectedDqnAction, observation.signalPhase);
    }

    /**
     * Store experience in replay buffer
     */
    storeExperience(
        observation: AgentObservation,
        action: AgentAction,
        reward: number,
        nextObservation: AgentObservation,
        done: boolean = false
    ): void {
        const state = this.observationToState(observation);
        const nextState = this.observationToState(nextObservation);

        // Convert agent action to DQN action
        const dqnAction: DQNAction = action === 'KEEP' ? 0 : 1;

        this.replayBuffer.push({
            state,
            action: dqnAction,
            reward,
            nextState,
            done,
        });
    }

    /**
     * Train the Q-network on a batch of experiences
     */
    train(): void {
        // Only train if we have enough experiences
        if (this.replayBuffer.size() < this.config.batchSize) {
            return;
        }

        // Sample batch from replay buffer
        const batch = this.replayBuffer.sample(this.config.batchSize);

        let totalLoss = 0;

        // Train on each experience in batch
        for (const experience of batch) {
            const { state, action, reward, nextState, done } = experience;

            // Compute target Q-value using target network
            const nextQValues = this.targetNetwork.forward(nextState);
            const maxNextQ = Math.max(...nextQValues);

            // Bellman equation: Q(s,a) = r + γ * max(Q(s',a'))
            const targetQ = done ? reward : reward + this.config.discountFactor * maxNextQ;

            // Get current Q-values
            const currentQValues = this.qNetwork.forward(state);

            // Create target output (only update the action taken)
            const targetOutput = [...currentQValues];
            targetOutput[action] = targetQ;

            // Update network weights
            const loss = this.qNetwork.updateWeights(state, targetOutput, this.config.learningRate);
            totalLoss += loss;
        }

        this.lastLoss = totalLoss / batch.length;
        this.trainingSteps++;

        // Log training progress with weight change indicators
        if (this.trainingSteps % 10 === 0) {
            console.log(
                `[DQN Training] Step ${this.trainingSteps}: ` +
                `Loss=${this.lastLoss.toFixed(6)}, ` +
                `AvgQ=${this.lastAvgQValue.toFixed(4)}, ` +
                `ε=${this.epsilon.toFixed(3)}, ` +
                `Exp=${this.replayBuffer.size()}`
            );
        }

        // Update target network periodically
        if (this.trainingSteps % this.config.targetUpdateFrequency === 0) {
            this.targetNetwork.copyFrom(this.qNetwork);
            console.log(
                `[DQN] ⚡ Target network updated at step ${this.trainingSteps} ` +
                `(Q-network weights copied to stabilize learning)`
            );
        }

        // Decay epsilon
        this.epsilon = Math.max(
            this.config.epsilonEnd,
            this.epsilon * this.config.epsilonDecay
        );
    }

    /**
   * Get current training metrics
   */
    getMetrics(): TrainingMetrics {
        return {
            epsilon: this.epsilon,
            loss: this.lastLoss,
            avgQValue: this.lastAvgQValue,
            experienceCount: this.replayBuffer.size(),
            trainingSteps: this.trainingSteps,
        };
    }

    /**
     * Get last Q-value decision details for UI display
     */
    getLastDecision(): QValueDecision | null {
        return this.lastQValueDecision;
    }

    /**
     * Get Q-value history for visualization
     */
    getQValueHistory(): number[][] {
        return this.qValueHistory;
    }

    /**
     * Get current Q-values for a given observation (for inspection)
     */
    getQValues(observation: AgentObservation): number[] {
        const state = this.observationToState(observation);
        return this.qNetwork.forward(state);
    }

    /**
   * Reset the agent (clear experiences, reset epsilon)
   */
    reset(): void {
        this.replayBuffer.clear();
        this.epsilon = this.config.epsilonStart;
        this.trainingSteps = 0;
        this.lastLoss = 0;
        this.lastAvgQValue = 0;
        this.lastQValueDecision = null;
        this.qValueHistory = [];
        console.log('[DQN] Agent reset - all learning cleared');
    }

    /**
     * Save agent state (for future persistence)
     */
    getState(): {
        epsilon: number;
        trainingSteps: number;
        experienceCount: number;
    } {
        return {
            epsilon: this.epsilon,
            trainingSteps: this.trainingSteps,
            experienceCount: this.replayBuffer.size(),
        };
    }
}

/**
 * Singleton instance of the DQN agent
 */
export const dqnAgent = new DQNAgent();
