/**
 * Comparison Logger
 *
 * Singleton module that records per-timestep traffic metrics
 * for each of the three control modes:
 *   - 'rule-based': Automatic fixed 6-second switching
 *   - 'dqn':        DQN learning without training noise
 *   - 'dqn-robust': DQN learning with training noise enabled
 *
 * Data is collected from Traffic State (ground truth .base values)
 * so all three modes are compared on the same objective measure.
 */

export type ComparisonMode = 'rule-based' | 'dqn' | 'dqn-robust';

export interface TimestepLog {
  /** Seconds since session started for this mode */
  time: number;
  /** Combined NS + EW queue length (Traffic State .base) */
  queueLength: number;
  /** Average waiting time across NS and EW (Traffic State .base) */
  avgWaitingTime: number;
  /** Combined flow rate (Traffic State .base) */
  flowRate: number;
  /** Reward received at this timestep */
  reward: number;
}

export interface ModeSession {
  mode: ComparisonMode;
  label: string;
  color: string;
  logs: TimestepLog[];
  sessionStart: number | null; // ms timestamp
}

// ────────────────────────────────────────────────────────────────
// Singleton state
// ────────────────────────────────────────────────────────────────

const SESSIONS: Record<ComparisonMode, ModeSession> = {
  'rule-based': {
    mode: 'rule-based',
    label: 'Rule-Based',
    color: '#3B82F6', // blue
    logs: [],
    sessionStart: null,
  },
  'dqn': {
    mode: 'dqn',
    label: 'DQN (No Noise)',
    color: '#F59E0B', // amber/yellow
    logs: [],
    sessionStart: null,
  },
  'dqn-robust': {
    mode: 'dqn-robust',
    label: 'DQN + Training Noise',
    color: '#10B981', // emerald/green
    logs: [],
    sessionStart: null,
  },
};

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

/**
 * Start a new recording session for the given mode.
 * Clears previous data for that mode and marks the start time.
 */
export function startSession(mode: ComparisonMode): void {
  SESSIONS[mode].logs = [];
  SESSIONS[mode].sessionStart = Date.now();
}

/**
 * Append a single timestep log entry for the given mode.
 * Should be called every 1 second while simulation is running.
 */
export function logTimestep(
  mode: ComparisonMode,
  entry: Omit<TimestepLog, 'time'>
): void {
  const session = SESSIONS[mode];
  if (session.sessionStart === null) {
    session.sessionStart = Date.now();
  }
  const elapsed = (Date.now() - session.sessionStart) / 1000;
  session.logs.push({ time: parseFloat(elapsed.toFixed(1)), ...entry });
}

/**
 * Get all recorded logs for a specific mode.
 */
export function getSessionLogs(mode: ComparisonMode): TimestepLog[] {
  return [...SESSIONS[mode].logs];
}

/**
 * Get all session metadata (for chart rendering).
 */
export function getAllSessions(): ModeSession[] {
  return Object.values(SESSIONS);
}

/**
 * Check whether a session has any recorded data.
 */
export function hasData(mode: ComparisonMode): boolean {
  return SESSIONS[mode].logs.length > 0;
}

/**
 * Clear all recorded data for all modes.
 */
export function clearAll(): void {
  for (const mode of Object.keys(SESSIONS) as ComparisonMode[]) {
    SESSIONS[mode].logs = [];
    SESSIONS[mode].sessionStart = null;
  }
}

/**
 * Determine the active mode key from simulation state.
 *
 * Classification:
 *  - Not in DQN mode          → 'rule-based'
 *  - DQN, all noise sliders 0  → 'dqn'         (clean observations)
 *  - DQN, any noise slider > 0 → 'dqn-robust'  (noisy observations)
 */
export function resolveMode(
  agentEnabled: boolean,
  dqnMode: boolean,
  noiseConfig: { queueLengthNoise: number; avgWaitingTimeNoise: number; avgSpeedNoise?: number }
): ComparisonMode {
  if (!agentEnabled || !dqnMode) return 'rule-based';
  const hasNoise =
    noiseConfig.queueLengthNoise > 0 ||
    noiseConfig.avgWaitingTimeNoise > 0 ||
    (noiseConfig.avgSpeedNoise ?? 0) > 0;
  return hasNoise ? 'dqn-robust' : 'dqn';
}
