export interface School {
  id: number;
  name: string;
  type: string;
  examStart: string | null;
  examEnd: string | null;
}

export interface Shift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  order: number;
}

export interface Teacher {
  id: number;
  firstName: string;
  lastName: string;
  specialty: string;
  specialtyLabel: string | null;
  role: string;
  educationType: "general" | "specialty" | "both";
}

export interface TeacherUnavailable {
  id: number;
  teacherId: number;
  date: string;
  shiftId: number | null; // null = whole day
  reason: string | null;
}

export interface Class {
  id: number;
  grade: string;
  department: string | null;
  label: string;
  schoolType: string;
  gradeOrder: number;
  studentCount: number;
  forceSplit: boolean;
}

export interface Subject {
  id: number;
  name: string;
  classId: number;
  presenterId: number | null;
  subjectType: string;
  durationMinutes: number;
  specialty: string | null;
  priority: number;
  canSplit: boolean;
  class?: Class | null;
  presenter?: Teacher | null;
}

export interface ExamSlot {
  id: number;
  subjectId: number;
  date: string;
  shiftId: number;
  presenterId: number | null;
  supervisorIds: string;
  isManuallyPlaced: boolean | null;
  notes: string | null;
  subject?: Subject | null;
  class?: Class | null;
  presenter?: Teacher | null;
  shift?: Shift | null;
  supervisors?: Teacher[];
}
