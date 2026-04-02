/**
 * Q-Value Display Component
 * 
 * Shows real-time Q-values and action selection from the DQN agent
 * to verify that learning is occurring and influencing decisions.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, TrendingUp, Zap } from 'lucide-react';
import { QValueDecision } from '@/corelogic/dqnAgent';

interface QValueDisplayProps {
    decision: QValueDecision | null;
    qValueHistory: number[][];
}

export function QValueDisplay({ decision, qValueHistory }: QValueDisplayProps) {
    if (!decision) {
        return (
            <Card className="w-full">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Brain className="w-4 h-4" />
                        Q-Value Monitor
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-xs text-muted-foreground italic">
                        Waiting for agent decision...
                    </p>
                </CardContent>
            </Card>
        );
    }

    const qKeep = decision.qValues[0];
    const qSwitch = decision.qValues[1];
    const maxQ = Math.max(Math.abs(qKeep), Math.abs(qSwitch));

    // Calculate Q-value trend (last 10 decisions)
    const recentHistory = qValueHistory.slice(-10);
    const avgRecentQ = recentHistory.length > 0
        ? recentHistory.reduce((sum, qVals) => sum + (qVals[0] + qVals[1]) / 2, 0) / recentHistory.length
        : 0;

    return (
        <Card className="w-full border-2 border-indigo-200 bg-indigo-50/50">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                    <Brain className="w-4 h-4 text-indigo-600" />
                    Q-Value Monitor (Learning Verification)
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Decision Mode Indicator */}
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                    <span className="text-xs font-medium">Decision Mode:</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${decision.wasRandom
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                        {decision.wasRandom ? '🎲 EXPLORE' : '🎯 EXPLOIT'}
                    </span>
                </div>

                {/* Q-Values Display */}
                <div className="space-y-2">
                    <div className="text-xs font-semibold text-indigo-900 mb-1">
                        Predicted Q-Values:
                    </div>

                    {/* Q(KEEP) */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-medium">Q(KEEP):</span>
                            <span className="text-xs font-mono font-bold text-blue-700">
                                {qKeep.toFixed(4)}
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all ${qKeep >= 0 ? 'bg-blue-500' : 'bg-red-500'
                                    }`}
                                style={{
                                    width: `${Math.min(100, (Math.abs(qKeep) / (maxQ || 1)) * 100)}%`,
                                }}
                            />
                        </div>
                    </div>

                    {/* Q(SWITCH) */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-medium">Q(SWITCH):</span>
                            <span className="text-xs font-mono font-bold text-purple-700">
                                {qSwitch.toFixed(4)}
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all ${qSwitch >= 0 ? 'bg-purple-500' : 'bg-red-500'
                                    }`}
                                style={{
                                    width: `${Math.min(100, (Math.abs(qSwitch) / (maxQ || 1)) * 100)}%`,
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Selected Action */}
                <div className="p-2 bg-white rounded border-2 border-indigo-300">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Selected Action:</span>
                        <span className={`text-sm font-bold px-3 py-1 rounded ${decision.actionName === 'KEEP'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                            {decision.actionName}
                        </span>
                    </div>
                    {!decision.wasRandom && (
                        <div className="mt-1 text-xs text-indigo-600">
                            ✓ Based on learned Q-values
                        </div>
                    )}
                </div>

                {/* Q-Value Trend */}
                {recentHistory.length > 0 && (
                    <div className="p-2 bg-white rounded border">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-3 h-3 text-green-600" />
                            <span className="text-xs font-medium">Avg Q-Value (last 10):</span>
                        </div>
                        <div className="text-xs font-mono font-bold text-green-700">
                            {avgRecentQ.toFixed(4)}
                        </div>
                    </div>
                )}

                {/* Learning Indicator */}
                <div className="text-xs text-indigo-700 bg-indigo-100 p-2 rounded border border-indigo-200">
                    <div className="flex items-center gap-1 mb-1">
                        <Zap className="w-3 h-3" />
                        <strong>Learning Active:</strong>
                    </div>
                    <div className="space-y-0.5">
                        <div>• Q-values update after each decision</div>
                        <div>• Weights change via gradient descent</div>
                        <div>• Epsilon: {decision.epsilon.toFixed(3)} (exploration rate)</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
