import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// School settings
export const school = sqliteTable("school", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().default("Σχολική Μονάδα"),
  type: text("type").notNull().default("ΓΕΛ"), // ΓΕΛ | ΕΠΑΛ
  examStart: text("exam_start"), // ISO date string
  examEnd: text("exam_end"),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// Shifts (βάρδιες)
export const shifts = sqliteTable("shifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), // Α Βάρδια, Β Βάρδια
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(120),
  order: integer("order").notNull().default(1),
});

// School unavailable days
export const schoolUnavailable = sqliteTable("school_unavailable", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // ISO date
  reason: text("reason"),
});

// Teachers
export const teachers = sqliteTable("teachers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  specialty: text("specialty").notNull(), // ΠΕ01, ΠΕ02, ΠΕ03, κλπ
  specialtyLabel: text("specialty_label"), // Θεολόγος, Φιλόλογος, Μαθηματικός...
  role: text("role").notNull().default("both"), // supervisor | presenter | both
  educationType: text("education_type").notNull().default("general"), // "general" | "specialty" | "both"
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// Teacher unavailable days
export const teacherUnavailable = sqliteTable("teacher_unavailable", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teacherId: integer("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // ISO date
  shiftId: integer("shift_id").references(() => shifts.id, { onDelete: "cascade" }), // null = whole day
  reason: text("reason"),
});

// Classes (τάξεις/τμήματα)
export const classes = sqliteTable("classes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  grade: text("grade").notNull(), // Α, Β, Γ
  department: text("department"), // Οικονομίας, Πληροφορικής, Ηλεκτρολογίας, null for ΓΕΛ
  label: text("label").notNull(), // π.χ. "Β Οικονομίας", "Γ ΓΕΛ"
  schoolType: text("school_type").notNull().default("ΓΕΛ"), // ΓΕΛ | ΕΠΑΛ
  gradeOrder: integer("grade_order").notNull().default(2), // 1=Α, 2=Β, 3=Γ (Γ=1 for priority)
  studentCount: integer("student_count").notNull().default(0), // αριθμός μαθητών
  forceSplit: integer("force_split", { mode: "boolean" }).notNull().default(false), // manual override για split
});

// Subjects (μαθήματα)
export const subjects = sqliteTable("subjects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  classId: integer("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  presenterId: integer("presenter_id").references(() => teachers.id, { onDelete: "set null" }),
  subjectType: text("subject_type").notNull().default("general"), // general | specialty
  durationMinutes: integer("duration_minutes").notNull().default(120), // 120 | 180
  specialty: text("specialty"), // ειδικότητα εισηγητή
  priority: integer("priority").notNull().default(5), // 1=high priority (Γεν. Παιδεία), 10=low
  canSplit: integer("can_split", { mode: "boolean" }).notNull().default(false), // μπορεί να χωριστεί σε 2 τμήματα
});

// Exam Schedule
export const examSchedule = sqliteTable("exam_schedule", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // ISO date
  shiftId: integer("shift_id").notNull().references(() => shifts.id),
  presenterId: integer("presenter_id").references(() => teachers.id, { onDelete: "set null" }),
  supervisorIds: text("supervisor_ids").notNull().default("[]"), // JSON array of teacher IDs
  isManuallyPlaced: integer("is_manually_placed", { mode: "boolean" }).default(false),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// Generation runs log
export const scheduleRuns = sqliteTable("schedule_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  score: real("score"),
  violations: text("violations").default("[]"), // JSON
  status: text("status").notNull().default("pending"), // pending | success | failed
});
