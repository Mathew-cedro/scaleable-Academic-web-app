import React, { useState } from 'react';
import type { Teacher, ScheduleAssignment, PeriodSlot } from '../types/schedule';
import { calculateTeacherWorkload } from '../utils/conflictDetector';
import { TeacherWorkloadBadge } from './TeacherWorkloadBadge';
import { X, UserPlus, Trash2, Edit3, Save, User } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  assignments: ScheduleAssignment[];
  periods: PeriodSlot[];
  onSaveTeacher: (teacher: Teacher) => void;
  onDeleteTeacher: (id: string) => void;
}

/**
 * ============================================================================
 * FACULTY MANAGER & WORKLOAD QUOTAS MODAL
 * ============================================================================
 * How it works:
 * 1. Faculty Administration:
 *    - Add new teachers to the school roster.
 *    - Edit full name, email, department, and calendar badge color.
 *    - Delete teachers (clears their assigned classes safely).
 * 2. Workload Threshold Customization:
 *    - Set individual Minimum Required Loads (defaults to 6; below this = Underloaded).
 *    - Set individual Overload Limits (defaults to 8; at or above = Overloaded).
 *    - Enables flexibility for part-time teachers or department heads with
 *      administrative release time.
 * ============================================================================
 */
export const TeacherManagerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  teachers,
  assignments,
  periods,
  onSaveTeacher,
  onDeleteTeacher,
}) => {
  if (!isOpen) return null;

  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states for creating / editing
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Mathematics');
  const [color, setColor] = useState('#A91079');
  const [minLoad, setMinLoad] = useState(6);
  const [overloadLimit, setOverloadLimit] = useState(8);

  const startCreate = () => {
    setIsCreating(true);
    setEditingTeacher(null);
    setName('');
    setEmail('');
    setDepartment('Mathematics');
    setColor('#A91079');
    setMinLoad(6);
    setOverloadLimit(8);
  };

  const startEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setIsCreating(false);
    setName(teacher.name);
    setEmail(teacher.email);
    setDepartment(teacher.department);
    setColor(teacher.color);
    setMinLoad(teacher.minLoad ?? 6);
    setOverloadLimit(teacher.overloadLimit ?? 8);
  };

  const cancelForm = () => {
    setEditingTeacher(null);
    setIsCreating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedTeacher: Teacher = {
      id: editingTeacher?.id || `t-${Date.now()}`,
      name,
      email,
      department,
      color,
      minLoad: Number(minLoad),
      maxLoad: Number(minLoad) + 1,
      overloadLimit: Number(overloadLimit),
    };
    onSaveTeacher(updatedTeacher);
    cancelForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E5CCE3] w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#A91079]" />
            <h2 className="text-base font-bold text-slate-900">Manage Faculty & Workload Quotas</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Create / Edit Form */}
          {(isCreating || editingTeacher) ? (
            <form onSubmit={handleSubmit} className="p-4 bg-slate-50 rounded-xl border border-[#E5CCE3] space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm">
                  {isCreating ? 'Add New Teacher' : `Edit: ${editingTeacher?.name}`}
                </h3>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Jane Smith"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="j.smith@highschool.edu"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Department</label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Mathematics"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Tag Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-300 p-0.5 cursor-pointer bg-white"
                    />
                    <span className="text-slate-500 font-mono text-[11px]">{color}</span>
                  </div>
                </div>
              </div>

              {/* Workload Limits */}
              <div className="p-3 bg-white rounded-lg border border-[#E5CCE3] grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">
                    Minimum Required Loads
                  </label>
                  <p className="text-[10px] text-slate-400 mb-1">Underloaded alert if below this</p>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={minLoad}
                    onChange={(e) => setMinLoad(Number(e.target.value))}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">
                    Overload Limit (Max)
                  </label>
                  <p className="text-[10px] text-slate-400 mb-1">Overloaded alert if reached/exceeded</p>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={overloadLimit}
                    onChange={(e) => setOverloadLimit(Number(e.target.value))}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs font-bold text-red-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-2xs"
                >
                  <Save className="w-4 h-4" />
                  Save Teacher
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={startCreate}
              className="w-full py-2.5 border border-dashed border-[#A91079] bg-[#FDF2FA]/40 hover:bg-[#FDF2FA] text-[#A91079] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <UserPlus className="w-4 h-4" />
              Add New Faculty Member
            </button>
          )}

          {/* Teacher List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Faculty Roster ({teachers.length})
            </h4>

            <div className="divide-y divide-slate-100 border border-[#E5CCE3] rounded-xl overflow-hidden bg-white">
              {teachers.map(teacher => {
                const stats = calculateTeacherWorkload(teacher, assignments, periods);
                return (
                  <div
                    key={teacher.id}
                    className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/70 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: teacher.color }}
                      />
                      <div>
                        <p className="font-bold text-slate-800">{teacher.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {teacher.department} • {teacher.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <TeacherWorkloadBadge
                        totalLoads={stats.totalLoads}
                        minLoad={teacher.minLoad}
                        overloadLimit={teacher.overloadLimit}
                        compact
                      />

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(teacher)}
                          className="p-1.5 text-slate-400 hover:text-[#A91079] hover:bg-slate-100 rounded transition"
                          title="Edit teacher"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            const count = assignments.filter(a => a.teacherId === teacher.id).length;
                            if (confirm(`Delete ${teacher.name}? (${count} class assignments will be cleared)`)) {
                              onDeleteTeacher(teacher.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded transition"
                          title="Delete teacher"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
