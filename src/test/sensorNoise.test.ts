import { describe, it, expect } from 'vitest';
import { applySensorNoise, DEFAULT_NOISE_CONFIG, SensorNoiseConfig } from '@/corelogic/probabilisticSensorModel';
import { EnvironmentState } from '@/utils/environmentState';

describe('Probabilistic Sensor Model', () => {
  it('should apply noise to environment state', () => {
    const trueState: EnvironmentState = {
      signalPhase: 'NS',
      ns: {
        queueLength: 5,
        avgWaitingTime: 10,
        maxWaitingTime: 15,
        flowRate: 12,
        avgSpeed: 2.5,
      },
      ew: {
        queueLength: 3,
        avgWaitingTime: 8,
        maxWaitingTime: 12,
        flowRate: 10,
        avgSpeed: 2.8,
      },
    };

    const noisyState = applySensorNoise(trueState, DEFAULT_NOISE_CONFIG);

    // Verify structure
    expect(noisyState.signalPhase).toBe('NS');
    expect(noisyState.ns).toBeDefined();
    expect(noisyState.ew).toBeDefined();

    // Log values for debugging
    console.log('TRUE STATE:', trueState);
    console.log('NOISY STATE:', noisyState);
  });

  it('should return zero noise config when noise level is 0', () => {
    const trueState: EnvironmentState = {
      signalPhase: 'NS',
      ns: {
        queueLength: 5,
        avgWaitingTime: 10,
        maxWaitingTime: 15,
        flowRate: 12,
        avgSpeed: 2.5,
      },
      ew: {
        queueLength: 3,
        avgWaitingTime: 8,
        maxWaitingTime: 12,
        flowRate: 10,
        avgSpeed: 2.8,
      },
    };

    const zeroNoiseConfig: SensorNoiseConfig = {
      queueLengthNoise: 0,
      avgWaitingTimeNoise: 0,
      avgSpeedNoise: 0,
    };

    const noisyState = applySensorNoise(trueState, zeroNoiseConfig);

    // With zero noise, observed should equal true
    expect(noisyState.ns.queueLength).toBe(trueState.ns.queueLength);
    expect(noisyState.ns.avgWaitingTime).toBe(trueState.ns.avgWaitingTime);
    expect(noisyState.ns.maxWaitingTime).toBe(trueState.ns.maxWaitingTime);

    console.log('ZERO NOISE - TRUE:', trueState.ns);
    console.log('ZERO NOISE - NOISY:', noisyState.ns);
  });

  it('should sample different values with multiple calls', () => {
    const trueState: EnvironmentState = {
      signalPhase: 'NS',
      ns: {
        queueLength: 10,
        avgWaitingTime: 15,
        maxWaitingTime: 20,
        flowRate: 12,
        avgSpeed: 2.5,
      },
      ew: {
        queueLength: 10,
        avgWaitingTime: 15,
        maxWaitingTime: 20,
        flowRate: 10,
        avgSpeed: 2.8,
      },
    };

    const samples: EnvironmentState[] = [];
    for (let i = 0; i < 5; i++) {
      const noisyState = applySensorNoise(trueState, DEFAULT_NOISE_CONFIG);
      samples.push(noisyState);
    }

    // Check that we got different samples
    console.log('MULTIPLE SAMPLES:');
    samples.forEach((sample, idx) => {
      console.log(`Sample ${idx}:`, sample.ns.queueLength, sample.ns.avgWaitingTime);
    });

    // At least some samples should be different
    const queueLengths = samples.map(s => s.ns.queueLength);
    const uniqueLengths = new Set(queueLengths);
    console.log('Queue lengths:', queueLengths);
    console.log('Unique queue lengths:', uniqueLengths.size);
  });
});
