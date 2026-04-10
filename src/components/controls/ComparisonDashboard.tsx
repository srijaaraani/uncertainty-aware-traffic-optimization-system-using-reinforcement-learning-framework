/**
 * Performance Comparison Dashboard
 *
 * Light-themed dashboard displaying time-series line charts comparing:
 *   - Rule-Based (blue)       : Fixed 6-second switching
 *   - DQN / No Noise (amber)  : DQN with zero training noise
 *   - DQN + Noise (green)     : Robust DQN with non-zero training noise
 *
 * Download: captures the entire container as PNG/JPEG via html2canvas.
 */

import React, { useMemo, useState, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3, Trash2, Info, Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import {
  getAllSessions,
  clearAll,
  type ComparisonMode,
  type TimestepLog,
} from '@/utils/comparisonLogger';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ChartRow {
  time: number;
  'rule-based'?: number;
  'dqn'?: number;
  'dqn-robust'?: number;
}

interface Props {
  dataVersion: number;
  onClear: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart data builder
// ─────────────────────────────────────────────────────────────────────────────

function buildChartData(
  metric: keyof Omit<TimestepLog, 'time'>,
): ChartRow[] {
  const sessions = getAllSessions();
  const timeSet = new Set<number>();
  for (const s of sessions) {
    for (const log of s.logs) timeSet.add(log.time);
  }
  const times = Array.from(timeSet).sort((a, b) => a - b);
  return times.map((t) => {
    const row: ChartRow = { time: t };
    for (const s of sessions) {
      const entry = s.logs.find((l) => l.time === t);
      if (entry) row[s.mode as ComparisonMode] = parseFloat(entry[metric].toFixed(2));
    }
    return row;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom tooltip (light)
// ─────────────────────────────────────────────────────────────────────────────

const CustomTooltip = ({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: any[];
  label?: number;
  unit: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-[10px] text-slate-400 mb-1.5 font-medium">t = {label}s</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs py-0.5">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-mono font-bold" style={{ color: p.color }}>
            {p.value?.toFixed(2)}{unit ? ` ${unit}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Mode badge (light)
// ─────────────────────────────────────────────────────────────────────────────

function ModeBadge({ label, color, hasData }: { label: string; color: string; hasData: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold border transition-all ${
        hasData ? '' : 'border-slate-200 text-slate-400 bg-slate-50'
      }`}
      style={hasData ? {
        backgroundColor: `${color}12`,
        borderColor: `${color}40`,
        color,
      } : {}}
    >
      <div
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasData ? 'animate-pulse' : 'opacity-30'}`}
        style={{ backgroundColor: hasData ? color : '#94a3b8' }}
      />
      {label}
      {!hasData && <span className="opacity-50 ml-0.5">(no data)</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart panel (light)
// ─────────────────────────────────────────────────────────────────────────────

function ChartPanel({
  title,
  dataKey,
  unit,
  yLabel,
  dataVersion,
}: {
  title: string;
  dataKey: keyof Omit<TimestepLog, 'time'>;
  unit: string;
  yLabel: string;
  dataVersion: number;
}) {
  const sessions = getAllSessions();
  const data = useMemo(() => buildChartData(dataKey), [dataKey, dataVersion]);
  const anyData = sessions.some((s) => s.logs.length > 0);

  if (!anyData) {
    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center h-52 gap-2">
        <BarChart3 className="w-7 h-7 text-slate-300" />
        <p className="text-xs text-slate-400 text-center">Run simulation in each mode to populate data</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-700 mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            tickFormatter={(v) => `${v}s`}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
            label={{
              value: yLabel,
              angle: -90,
              position: 'insideLeft',
              offset: 12,
              style: { fontSize: 9, fill: '#94a3b8' },
            }}
          />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          <Legend
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: '10px', paddingTop: '6px', color: '#64748b' }}
          />
          {sessions.map((s) =>
            s.logs.length > 0 ? (
              <Line
                key={s.mode}
                type="monotone"
                dataKey={s.mode}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                connectNulls
              />
            ) : null
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary stats (light)
// ─────────────────────────────────────────────────────────────────────────────

function SummaryStats() {
  const sessions = getAllSessions();
  const anyData = sessions.some((s) => s.logs.length > 0);
  if (!anyData) return null;

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const statGroups: {
    label: string;
    metric: keyof Omit<TimestepLog, 'time'>;
    unit: string;
    lowerIsBetter: boolean;
  }[] = [
    { label: 'Avg Queue Length', metric: 'queueLength', unit: 'veh', lowerIsBetter: true },
    { label: 'Avg Wait Time', metric: 'avgWaitingTime', unit: 's', lowerIsBetter: true },
    { label: 'Avg Flow Rate', metric: 'flowRate', unit: 'veh/min', lowerIsBetter: false },
    { label: 'Avg Reward', metric: 'reward', unit: '', lowerIsBetter: false },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {statGroups.map((g) => {
        const values = sessions
          .filter((s) => s.logs.length > 0)
          .map((s) => ({
            mode: s.mode,
            label: s.label,
            color: s.color,
            raw: avg(s.logs.map((l) => l[g.metric] as number)),
          }));

        const bestRaw = g.lowerIsBetter
          ? Math.min(...values.map((v) => v.raw))
          : Math.max(...values.map((v) => v.raw));

        return (
          <div key={g.metric} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {g.label}
            </p>
            <div className="space-y-1.5">
              {values.map((v) => (
                <div key={v.mode} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: v.color }} />
                    <span className="text-[10px] text-slate-500">{v.label}</span>
                  </div>
                  <span
                    className="text-xs font-mono font-bold"
                    style={{ color: v.raw === bestRaw ? v.color : '#64748b' }}
                  >
                    {v.raw === bestRaw ? '★ ' : ''}{v.raw.toFixed(2)}{g.unit ? ` ${g.unit}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────

export function ComparisonDashboard({ dataVersion: _dataVersion, onClear }: Props) {
  const sessions = getAllSessions();
  const [showInfo, setShowInfo] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const anyData = sessions.some((s) => s.logs.length > 0);

  const handleClear = () => {
    clearAll();
    onClear();
  };

  const handleDownload = async (format: 'png' | 'jpeg') => {
    if (!containerRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,           // 2× for crisp resolution
        useCORS: true,
        logging: false,
      });
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, 0.95);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `traffic-comparison-${Date.now()}.${format}`;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Performance Comparison</h2>
            <p className="text-[10px] text-slate-400">
              Ground-truth metrics · Traffic State baseline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Info */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
            title="How to use"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {/* Download buttons */}
          {anyData && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleDownload('png')}
                disabled={downloading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-200 transition-all disabled:opacity-50"
                title="Download as PNG"
              >
                {downloading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                PNG
              </button>
              <button
                onClick={() => handleDownload('jpeg')}
                disabled={downloading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-slate-600 hover:text-slate-700 hover:bg-slate-50 border border-slate-200 transition-all disabled:opacity-50"
                title="Download as JPEG"
              >
                {downloading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                JPEG
              </button>
            </div>
          )}

          {/* Clear */}
          {anyData && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 border border-red-200 transition-all"
              title="Clear all data"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Info panel */}
      {showInfo && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-[10px] text-slate-500 leading-relaxed space-y-1">
          <p className="font-semibold text-indigo-700 mb-1">How to collect comparison data:</p>
          <p>1. Run <span className="text-blue-600 font-semibold">Automatic</span> (no DQN) for ~60s → logs as Rule-Based</p>
          <p>2. Enable <span className="text-amber-600 font-semibold">DQN</span> with all noise sliders at 0 → logs as DQN (No Noise)</p>
          <p>3. Enable <span className="text-emerald-600 font-semibold">DQN</span> with any noise slider &gt; 0 → logs as DQN + Training Noise</p>
          <p className="text-slate-400 mt-1 pt-1 border-t border-indigo-100">All metrics use Traffic State ground truth (.base). Use PNG/JPEG buttons to export.</p>
        </div>
      )}

      {/* Mode badges */}
      <div className="flex flex-wrap gap-2">
        {sessions.map((s) => (
          <ModeBadge key={s.mode} label={s.label} color={s.color} hasData={s.logs.length > 0} />
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-slate-100" />

      {/* Charts */}
      <div className="space-y-4">
        <ChartPanel title="Queue Length vs Time"        dataKey="queueLength"   unit="veh"     yLabel="vehicles" dataVersion={_dataVersion} />
        <ChartPanel title="Average Waiting Time vs Time" dataKey="avgWaitingTime" unit="s"       yLabel="seconds"  dataVersion={_dataVersion} />
        <ChartPanel title="Flow Rate vs Time"            dataKey="flowRate"       unit="veh/min" yLabel="veh/min"  dataVersion={_dataVersion} />
        <ChartPanel title="Reward vs Time"               dataKey="reward"         unit=""        yLabel="reward"   dataVersion={_dataVersion} />
      </div>

      {/* Summary stats */}
      {anyData && (
        <>
          <div className="border-t border-slate-100" />
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Session Averages  <span className="text-slate-300 font-normal">(★ = best)</span>
            </p>
            <SummaryStats />
          </div>
        </>
      )}

      {!anyData && (
        <div className="text-center py-6">
          <p className="text-xs text-slate-400">No data yet. Start the simulation to begin recording.</p>
        </div>
      )}
    </div>
  );
}
