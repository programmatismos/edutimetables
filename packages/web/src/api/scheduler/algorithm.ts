/**
 * EduTimetables, Backtracking CSP Exam Scheduler
 *
 * Variables:    One per subject (what slot to assign)
 * Domain:       All (date, shift) combinations within exam period
 * Hard constraints (prune domain / reject assignment):
 *   H1. School unavailable on date
 *   H2. Presenter unavailable on date
 *   H3. Same class already has exam in that shift
 *   H4. Same class already has exam that day (max 1/day per class)
 *   H5. Presenter already presenting in that shift (another subject)
 *   H6. Presenter assigned as supervisor in that shift (conflict of roles)
 * Soft constraints (domain ordering heuristic, prefer but don't enforce):
 *   S1. Γ' τάξη exams early in period
 *   S2. Gap ("ανάσα") between exams of same class, penalise consecutive days
 *   S3. Specialties of same grade on same date when possible (not enforced, just preferred)
 *   S4. Supervisor load balance (3h = 1.5× weight)
 *   S5. Avoid teacher supervising twice in same day
 *
 * Variable ordering: MRV (Minimum Remaining Values), schedule the hardest-to-place subject first.
 * Value ordering:    Least-constraining value, prefer slots that leave most options open.
 * Forward checking:  After each assignment, eliminate values from remaining variables' domains.
 */

export interface SchedulerInput {
  school: { examStart: string | null; examEnd: string | null; type: string };
  splitThreshold?: number; // αριθμός μαθητών πάνω από τον οποίο γίνεται αυτόματο split (default 25)
  shifts: Array<{ id: number; name: string; startTime: string; endTime: string; durationMinutes: number; order: number }>;
  schoolUnavailable: Array<{ date: string }>;
  teachers: Array<{
    id: number; firstName: string; lastName: string;
    specialty: string; specialtyLabel: string | null;
    role: string; educationType: string;
  }>;
  teacherUnavailable: Array<{ teacherId: number; date: string }>;
  subjects: Array<{
    id: number; name: string; classId: number;
    presenterId: number | null; subjectType: string;
    durationMinutes: number; specialty: string | null; priority: number;
    canSplit: boolean;
    class: { id: number; grade: string; department: string | null; label: string; schoolType: string; gradeOrder: number; studentCount: number; forceSplit: boolean } | null;
    presenter: { id: number; specialty: string } | null;
  }>;
}

export interface ScheduledSlot {
  subjectId: number;
  date: string;
  shiftId: number;
  presenterId: number | null;
  supervisorIds: number[];
  isSplit?: boolean; // αν true → δύο παράλληλες εγγραφές με τους supervisors χωρισμένους
}

export interface SchedulerResult {
  slots: ScheduledSlot[];
  score: number;
  violations: string[];
  unscheduled: number[];
}

// Βοηθητικές συναρτήσεις ημερομηνιών.

function getWorkingDates(start: string, end: string, unavailable: Set<string>): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const endDate = new Date(end);
  while (cur <= endDate) {
    const dow = cur.getDay();
    const iso = cur.toISOString().split("T")[0];
    if (dow !== 0 && dow !== 6 && !unavailable.has(iso)) dates.push(iso);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

type Slot = { date: string; shiftId: number };
type Assignment = Map<number, Slot>; // subjectId → slot

// Κατάσταση που χρησιμοποιείται μέσα στην αναζήτηση του scheduler.

interface SearchState {
  // Ποια ημερομηνία και βάρδια έχει ήδη δεσμεύσει κάθε τάξη.
  classShift: Map<string, number>;   // key: `${classId}_${date}_${shiftId}` → subjectId
  classDay:   Map<string, number>;   // key: `${classId}_${date}` → count
  presenterShift: Map<string, number>; // key: `${presenterId}_${date}_${shiftId}` → subjectId
  // Κρατάμε επιτήρηση ανά ακριβή βάρδια, όχι μόνο ανά ημέρα. Χωρίς αυτό,
  // ο ίδιος καθηγητής μπορούσε να τοποθετηθεί σε δύο ταυτόχρονες επιτηρήσεις.
  supervisorShift: Map<string, number>; // key: `${teacherId}_${date}_${shiftId}` → subjectId
  // Supervision hours per teacher
  supHours: Map<number, number>;
  // Supervision per teacher per day
  supDay: Map<string, number>;       // key: `${teacherId}_${date}`
}

function cloneState(s: SearchState): SearchState {
  return {
    classShift:     new Map(s.classShift),
    classDay:       new Map(s.classDay),
    presenterShift: new Map(s.presenterShift),
    supervisorShift: new Map(s.supervisorShift),
    supHours:       new Map(s.supHours),
    supDay:         new Map(s.supDay),
  };
}

// Κύρια συνάρτηση δημιουργίας προγράμματος.

export function runScheduler(input: SchedulerInput): SchedulerResult {
  const { school, shifts, schoolUnavailable, teachers, teacherUnavailable, subjects, splitThreshold = 25 } = input;

  if (!school.examStart || !school.examEnd) {
    return { slots: [], score: 0, violations: ["Δεν έχουν οριστεί ημερομηνίες εξεταστικής"], unscheduled: subjects.map(s => s.id) };
  }

  const schoolUnavailSet = new Set(schoolUnavailable.map(u => u.date));
  const workingDates = getWorkingDates(school.examStart, school.examEnd, schoolUnavailSet);

  if (workingDates.length === 0) {
    return { slots: [], score: 0, violations: ["Δεν υπάρχουν διαθέσιμες εργάσιμες μέρες στην εξεταστική"], unscheduled: subjects.map(s => s.id) };
  }

  // Οι αδυναμίες καθηγητών υποστηρίζουν είτε ολόκληρη ημέρα είτε συγκεκριμένη βάρδια.
  // Το map κρατά χωριστά τις ημερήσιες και τις ανά βάρδια αδυναμίες για γρήγορο έλεγχο.
  const teacherUnavailMap = new Map<number, { wholeDays: Set<string>; shiftSlots: Set<string> }>();
  for (const tu of teacherUnavailable as Array<{ teacherId: number; date: string; shiftId?: number | null }>) {
    if (!teacherUnavailMap.has(tu.teacherId)) teacherUnavailMap.set(tu.teacherId, { wholeDays: new Set(), shiftSlots: new Set() });
    const entry = teacherUnavailMap.get(tu.teacherId)!;
    if (tu.shiftId == null) {
      entry.wholeDays.add(tu.date);
    } else {
      entry.shiftSlots.add(`${tu.date}|${tu.shiftId}`);
    }
  }

  function isTeacherUnavail(teacherId: number, date: string, shiftId: number): boolean {
    const entry = teacherUnavailMap.get(teacherId);
    if (!entry) return false;
    return entry.wholeDays.has(date) || entry.shiftSlots.has(`${date}|${shiftId}`);
  }

  // All possible slots
  const allSlots: Slot[] = [];
  for (const date of workingDates) {
    for (const shift of shifts) {
      allSlots.push({ date, shiftId: shift.id });
    }
  }

  // Αρχικό domain για κάθε μάθημα.
  // Κόβουμε εξαρχής τα slots όπου ο εισηγητής έχει δηλώσει αδυναμία.
  function initialDomain(subject: typeof subjects[0]): Slot[] {
    return allSlots.filter(slot => {
      // Presenter available
      if (subject.presenterId && isTeacherUnavail(subject.presenterId, slot.date, slot.shiftId)) return false;
      return true;
    });
  }

  // Σειρά επιλογής μεταβλητών.
  // Μπαίνουν πρώτα τα μαθήματα της Γ τάξης και μετά όσα έχουν τα λιγότερα διαθέσιμα slots.
  const domainSizes = new Map<number, number>();
  for (const s of subjects) {
    domainSizes.set(s.id, initialDomain(s).length);
  }

  const orderedSubjects = [...subjects].sort((a, b) => {
    // Γ grade (gradeOrder=3) first
    const gradeA = a.class?.gradeOrder ?? 2;
    const gradeB = b.class?.gradeOrder ?? 2;
    if (gradeB !== gradeA) return gradeB - gradeA;
    // MRV: fewest domain values first
    const domA = domainSizes.get(a.id) ?? 999;
    const domB = domainSizes.get(b.id) ?? 999;
    if (domA !== domB) return domA - domB;
    // Lower priority number = more important
    return a.priority - b.priority;
  });

  function needsSplit(subject: typeof subjects[0]): boolean {
    // Υπολογίζουμε το split πριν από το backtracking, ώστε ο αλγόριθμος να μην
    // αποδεχτεί slot split μαθήματος αν δεν υπάρχουν δύο διαθέσιμοι επιτηρητές.
    if (!subject.canSplit) return false;
    const cls = subject.class;
    if (!cls) return false;
    return cls.forceSplit || (cls.studentCount > splitThreshold);
  }

  // Έλεγχος σκληρών περιορισμών για ένα πιθανό slot.
  function isConsistent(
    subject: typeof subjects[0],
    slot: Slot,
    state: SearchState
  ): boolean {
    const { date, shiftId } = slot;

    // H3: same class already in this shift
    if (state.classShift.has(`${subject.classId}_${date}_${shiftId}`)) return false;

    // H4: same class already has an exam today
    if ((state.classDay.get(`${subject.classId}_${date}`) ?? 0) >= 1) return false;

    // H5 + H6: presenter conflict
    if (subject.presenterId) {
      if (state.presenterShift.has(`${subject.presenterId}_${date}_${shiftId}`)) return false;
      // Ο εισηγητής δεν επιτρέπεται να είναι ήδη επιτηρητής σε άλλο μάθημα
      // της ίδιας βάρδιας, γιατί αυτό είναι πραγματική χρονική σύγκρουση.
      if (state.supervisorShift.has(`${subject.presenterId}_${date}_${shiftId}`)) return false;
    }

    return true;
  }

  // Επιλογή επιτηρητών για το συγκεκριμένο μάθημα και slot.
  function pickSupervisors(
    subject: typeof subjects[0],
    slot: Slot,
    state: SearchState
  ): number[] {
    const { date, shiftId } = slot;
    const presenterSpecialty = subject.presenter?.specialty ?? subject.specialty;
    const isSpecialty = subject.subjectType === "specialty";

    const eligible = teachers.filter(t => {
      if (t.id === subject.presenterId) return false;
      if (t.role === "presenter") return false;
      // Unavailable
      if (isTeacherUnavail(t.id, date, shiftId)) return false;
      // Same specialty for specialty subjects → can't supervise
      if (isSpecialty && presenterSpecialty && t.specialty === presenterSpecialty) return false;
      // Already presenting in this shift
      if (state.presenterShift.has(`${t.id}_${date}_${shiftId}`)) return false;
      // Already supervising in this shift
      // Αποκλείουμε καθηγητή που έχει ήδη επιλεγεί ως επιτηρητής στην ίδια
      // ημερομηνία/βάρδια, αλλά συνεχίζουμε να επιτρέπουμε δεύτερη επιτήρηση
      // άλλη ώρα της ίδιας μέρας ώστε να λειτουργεί η ισοκατανομή.
      if (state.supervisorShift.has(`${t.id}_${date}_${shiftId}`)) return false;
      return true;
    });

    // Sort: fewest total supervision hours, penalise same-day supervision
    eligible.sort((a, b) => {
      const hA = (state.supHours.get(a.id) ?? 0) + (state.supDay.get(`${a.id}_${date}`) ?? 0) * 0.5;
      const hB = (state.supHours.get(b.id) ?? 0) + (state.supDay.get(`${b.id}_${date}`) ?? 0) * 0.5;
      return hA - hB;
    });

    return eligible.slice(0, 2).map(t => t.id);
  }

  // Σειρά δοκιμής slots με λογική Least Constraining Value.
  // Προτιμάμε slots που περιορίζουν λιγότερο τα επόμενα μαθήματα της ίδιας τάξης.
  function orderDomain(
    domain: Slot[],
    subject: typeof subjects[0],
    state: SearchState,
    remaining: typeof subjects
  ): Slot[] {
    // Score: count how many remaining subjects would lose a value if we pick this slot
    return domain.slice().sort((a, b) => {
      let constrainsA = 0, constrainsB = 0;
      for (const other of remaining) {
        if (other.id === subject.id) continue;
        if (other.classId === subject.classId) {
          // Same class: this date becomes unavailable for that class
          if (!state.classDay.has(`${other.classId}_${a.date}`)) constrainsA++;
          if (!state.classDay.has(`${other.classId}_${b.date}`)) constrainsB++;
        }
      }
      // Προτιμάμε νωρίτερες ημερομηνίες ως ήπιο κριτήριο για τα πιο κρίσιμα μαθήματα.
      const dateA = workingDates.indexOf(a.date);
      const dateB = workingDates.indexOf(b.date);
      return (constrainsA - constrainsB) || (dateA - dateB);
    });
  }

  // Εφαρμογή ανάθεσης στο προσωρινό state του backtracking.
  function applyAssignment(
    subject: typeof subjects[0],
    slot: Slot,
    supervisorIds: number[],
    state: SearchState
  ): void {
    const { date, shiftId } = slot;
    state.classShift.set(`${subject.classId}_${date}_${shiftId}`, subject.id);
    state.classDay.set(`${subject.classId}_${date}`, (state.classDay.get(`${subject.classId}_${date}`) ?? 0) + 1);
    if (subject.presenterId) {
      state.presenterShift.set(`${subject.presenterId}_${date}_${shiftId}`, subject.id);
    }
    const weight = subject.durationMinutes >= 180 ? 1.5 : 1;
    for (const sid of supervisorIds) {
      // Η εγγραφή εδώ είναι η πηγή αλήθειας για τους επόμενους ελέγχους
      // σύγκρουσης επιτηρητών μέσα στο ίδιο κλαδί του backtracking.
      state.supervisorShift.set(`${sid}_${date}_${shiftId}`, subject.id);
      state.supHours.set(sid, (state.supHours.get(sid) ?? 0) + weight);
      const dk = `${sid}_${date}`;
      state.supDay.set(dk, (state.supDay.get(dk) ?? 0) + 1);
    }
  }

  // Αναδρομική αναζήτηση backtracking.
  const finalAssignment: Assignment = new Map();
  const finalSupervisors: Map<number, number[]> = new Map();

  function backtrack(
    index: number,
    assignment: Assignment,
    supervisors: Map<number, number[]>,
    state: SearchState
  ): boolean {
    if (index === orderedSubjects.length) return true; // all assigned

    const subject = orderedSubjects[index];
    const domain = initialDomain(subject);
    const ordered = orderDomain(domain, subject, state, orderedSubjects.slice(index + 1));

    for (const slot of ordered) {
      if (!isConsistent(subject, slot, state)) continue;

      const sups = pickSupervisors(subject, slot, state);
      // Split μάθημα χωρίς δύο επιτηρητές θα γινόταν αργότερα κανονική
      // μονή εγγραφή. Το κόβουμε εδώ ώστε το αποτέλεσμα να είναι ειλικρινές.
      if (needsSplit(subject) && sups.length < 2) continue;

      const newState = cloneState(state);
      applyAssignment(subject, slot, sups, newState);

      assignment.set(subject.id, slot);
      supervisors.set(subject.id, sups);

      if (backtrack(index + 1, assignment, supervisors, newState)) return true;

      // Undo
      assignment.delete(subject.id);
      supervisors.delete(subject.id);
    }

    return false; // Δεν βρέθηκε έγκυρο slot, άρα ενεργοποιείται backtracking.
  }

  const initState: SearchState = {
    classShift:     new Map(),
    classDay:       new Map(),
    presenterShift: new Map(),
    supervisorShift: new Map(),
    supHours:       new Map(teachers.map(t => [t.id, 0])),
    supDay:         new Map(),
  };

  const success = backtrack(0, finalAssignment, finalSupervisors, initState);

  // Δημιουργία τελικού αποτελέσματος από τις αναθέσεις που βρέθηκαν.
  const slots: ScheduledSlot[] = [];
  const unscheduled: number[] = [];
  const violations: string[] = [];

  // Recompute final state for scoring
  const finalState = cloneState(initState);
  for (const subject of orderedSubjects) {
    const slot = finalAssignment.get(subject.id);
    if (!slot) {
      unscheduled.push(subject.id);
      violations.push(`Δεν βρέθηκε θέση: ${subject.name} (${subject.class?.label ?? ""})`);
      continue;
    }
    const sups = finalSupervisors.get(subject.id) ?? [];
    applyAssignment(subject, slot, sups, finalState);
    const isSplit = needsSplit(subject);
    slots.push({
      subjectId: subject.id,
      date: slot.date,
      shiftId: slot.shiftId,
      presenterId: subject.presenterId ?? null,
      supervisorIds: sups,
      isSplit,
    });
  }

  // Score: start at 100, deduct for unplaced + supervision imbalance
  let score = 100 - unscheduled.length * 10;
  const supValues = [...finalState.supHours.values()];
  if (supValues.length > 1) {
    const avg = supValues.reduce((a, b) => a + b, 0) / supValues.length;
    const variance = supValues.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / supValues.length;
    score -= Math.sqrt(variance) * 2;
  }

  if (!success && unscheduled.length > 0) {
    violations.push(`Ο αλγόριθμος δεν κατάφερε να τοποθετήσει ${unscheduled.length} μάθημα(τα). Ελέγξτε τις διαθεσιμότητες και τις ημερομηνίες.`);
  }

  return { slots, score: Math.max(0, Math.round(score)), violations, unscheduled };
}
