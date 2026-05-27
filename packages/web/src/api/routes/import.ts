import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";

export const importRoutes = new Hono()
  .post("/", async (c) => {
    try {
      const body = await c.req.json();
      const { teachers: teacherList = [], classes: classList = [], subjects: subjectList = [] } = body;

      const result = { teachers: 0, classes: 0, subjects: 0, errors: [] as string[] };

      // 1. Insert teachers
      if (teacherList.length > 0) {
        const sanitized = teacherList.map((t: any) => ({
          firstName: String(t.firstName || "").trim(),
          lastName: String(t.lastName || "").trim(),
          specialty: String(t.specialty || "ΠΕ00").trim(),
          specialtyLabel: t.specialtyLabel ? String(t.specialtyLabel).trim() : null,
          role: ["supervisor", "presenter", "both"].includes(t.role) ? t.role : "both",
          educationType: ["general", "specialty", "both"].includes(t.educationType) ? t.educationType : "general",
        })).filter((t: any) => t.firstName && t.lastName);
        if (sanitized.length > 0) {
          await db.insert(schema.teachers).values(sanitized);
          result.teachers = sanitized.length;
        }
      }

      // 2. Insert classes
      const classIdMap: Record<string, number> = {}; // label -> id
      if (classList.length > 0) {
        for (const cl of classList) {
          const grade = String(cl.grade || "").trim();
          const label = String(cl.label || cl.grade || "").trim();
          if (!grade || !label) continue;
          const gradeOrder = grade === "Α" ? 1 : grade === "Β" ? 2 : 3;
          const [inserted] = await db.insert(schema.classes).values({
            grade,
            department: cl.department ? String(cl.department).trim() : null,
            label,
            schoolType: ["ΓΕΛ", "ΕΠΑΛ"].includes(cl.schoolType) ? cl.schoolType : "ΓΕΛ",
            gradeOrder,
            studentCount: parseInt(cl.studentCount) || 0,
            forceSplit: false,
          }).returning();
          classIdMap[label] = inserted.id;
          result.classes++;
        }
      }

      // 3. Insert subjects (need classId resolution)
      if (subjectList.length > 0) {
        // Get all classes (including pre-existing)
        const allClasses = await db.select().from(schema.classes);
        const allTeachers = await db.select().from(schema.teachers);

        for (const s of subjectList) {
          const name = String(s.name || "").trim();
          if (!name) continue;

          // Resolve classId by label
          let classId: number | null = null;
          if (s.classLabel) {
            const found = allClasses.find(c => c.label === String(s.classLabel).trim());
            if (found) classId = found.id;
          }
          if (!classId && s.classId) classId = parseInt(s.classId);
          if (!classId) continue; // skip subjects without valid class

          // Resolve presenterId by lastName or full name
          let presenterId: number | null = null;
          if (s.presenterName) {
            const name = String(s.presenterName).trim().toLowerCase();
            const found = allTeachers.find(t =>
              `${t.firstName} ${t.lastName}`.toLowerCase() === name ||
              `${t.lastName} ${t.firstName}`.toLowerCase() === name ||
              t.lastName.toLowerCase() === name
            );
            if (found) presenterId = found.id;
          }

          await db.insert(schema.subjects).values({
            name,
            classId,
            presenterId,
            subjectType: ["general", "specialty"].includes(s.subjectType) ? s.subjectType : "general",
            durationMinutes: parseInt(s.durationMinutes) === 180 ? 180 : 120,
            specialty: s.specialty ? String(s.specialty).trim() : null,
            priority: parseInt(s.priority) || 5,
            canSplit: s.canSplit === true || s.canSplit === "true" || s.canSplit === 1,
          });
          result.subjects++;
        }
      }

      return c.json({ ok: true, ...result }, 200);
    } catch (err: any) {
      console.error("[import] failed:", err);
      return c.json({ error: err?.message ?? String(err) }, 500);
    }
  });
