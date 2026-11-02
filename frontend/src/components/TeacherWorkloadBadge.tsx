import React from 'react';
import type { TeacherLoadStatus } from '../types/schedule';
import { AlertTriangle, CheckCircle2, AlertOctagon } from 'lucide-react';

interface Props {
  totalLoads: number;        // Current total teaching loads assigned to the teacher
  minLoad?: number;          // Minimum required load (default: 6)
  overloadLimit?: number;    // Maximum allowed load (default: 8)
  compact?: boolean;         // When true, renders an inline pill for table headers/cards
  showBar?: boolean;         // When true, displays a visual progress bar
}

/**
 * ============================================================================
 * TEACHER WORKLOAD BADGE COMPONENT
 * ============================================================================
 * How it works:
 * 1. Checks total assigned classes against workload parameters:
 *    - totalLoads < 6: 'underloaded' (Amber badge with warning icon)
 *    - 6 <= totalLoads <= 7: 'optimal' (Emerald badge with check icon)
 *    - totalLoads >= 8: 'overloaded' (Red badge with alert icon)
 * 2. Visual modes:
 *    - Compact: Inline pill format for timetables and tables
 *    - Detailed: Informative box with progress bar and advice message
 * ============================================================================
 */
export const TeacherWorkloadBadge: React.FC<Props> = ({
  totalLoads,
  minLoad = 6,
  overloadLimit = 8,
  compact = false,
  showBar = false,
}) => {
  // Determine workload classification
  let status: TeacherLoadStatus = 'optimal';
  if (totalLoads < minLoad) {
    status = 'underloaded';
  } else if (totalLoads >= overloadLimit) {
    status = 'overloaded';
  }

  // Get color styles and icons based on status
  const getStatusConfig = () => {
    switch (status) {
      case 'underloaded':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-300',
          badgeBg: 'bg-amber-500',
          label: 'Underloaded',
          subtext: `${totalLoads}/${minLoad} min loads`,
          icon: AlertTriangle,
          textColor: 'text-amber-700',
        };
      case 'overloaded':
        return {
          bg: 'bg-red-50 text-red-800 border-red-300',
          badgeBg: 'bg-red-600',
          label: 'Overloaded',
          subtext: `${totalLoads}/${overloadLimit} max loads`,
          icon: AlertOctagon,
          textColor: 'text-red-700',
        };
      case 'optimal':
      default:
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
          badgeBg: 'bg-emerald-500',
          label: 'Balanced',
          subtext: `${totalLoads} loads (6-7 target)`,
          icon: CheckCircle2,
          textColor: 'text-emerald-700',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // Compact inline badge rendering
  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${config.bg}`}
        title={`Workload: ${totalLoads} classes (${config.label})`}
      >
        <Icon className="w-3 h-3" />
        <span>{totalLoads} loads</span>
        <span className="font-bold opacity-80">({config.label})</span>
      </span>
    );
  }

  // Calculate percentage toward overload limit for the progress bar
  const maxScale = Math.max(overloadLimit + 1, totalLoads, 9);
  const percentage = Math.min(100, Math.round((totalLoads / maxScale) * 100));

  return (
    <div className={`p-2.5 rounded-lg border ${config.bg} transition-all`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon className="w-4 h-4 shrink-0" />
          <span className="font-semibold text-xs uppercase tracking-wider">{config.label}</span>
        </div>
        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-white/70 shadow-xs">
          {totalLoads} {totalLoads === 1 ? 'class' : 'classes'}
        </span>
      </div>

      <div className="mt-1 text-xs opacity-90">
        {status === 'underloaded' && (
          <span>Needs <strong>{minLoad - totalLoads}</strong> more class(es) to meet 6-load minimum quota.</span>
        )}
        {status === 'optimal' && (
          <span>Within compliant 6–7 teaching load quota.</span>
        )}
        {status === 'overloaded' && (
          <span className="font-medium text-red-700">Exceeds 8-load safety cap! Reassign classes to colleagues.</span>
        )}
      </div>

      {showBar && (
        <div className="mt-2 w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${config.badgeBg}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
};
