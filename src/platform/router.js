import express from 'express';
import { randomUUID } from 'node:crypto';
import { activityDto, boundedText, fail, insertActivity, ownedActivity, publishActivity, updateActivity } from './activities.js';
import { beginAttempt, getAttempt, reviewAttempt, saveAttempt, sendTutor, submitAttempt, badgesFor, summarizeAlternatives } from './attempts.js';
import { seedActivity } from './seed.js';

const groupDto = row => ({ id: row.id, name: row.name, grade: row.grade, createdAt: row.created_at });
const studentDto = row => ({ id: row.id, username: row.username, name: row.name, role: row.role, disabled: row.disabled });
async function ownedGroup(db, owner, id, lock = false) {
  const row = (await db.query(`SELECT * FROM groups WHERE id=$1 AND owner_id=$2${lock ? ' FOR UPDATE' : ''}`, [id, owner])).rows[0];
  if (!row) fail(404, 'Grupo no encontrado.');
  return row;
}
export function createPlatformRouter({ db, auth, tutor = null } = {}) {
  const router = express.Router();
  router.use(auth.requireUser);
  router.use((req, res, next) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? next() : auth.requireCsrf(req, res, next));
  const teacher = auth.requireRole('teacher');
  const student = auth.requireRole('student');
  const attemptView = async (user, id) => {
    const view = await getAttempt(db, user, id);
    view.tutor.available = typeof tutor === 'function';
    return view;
  };

  router.get('/groups', teacher, async (req, res) => {
    const rows = (await db.query('SELECT * FROM groups WHERE owner_id=$1 ORDER BY created_at DESC', [req.user.id])).rows;
    res.json({ groups: rows.map(groupDto) });
  });
  router.post('/groups', teacher, async (req, res) => {
    const name = boundedText(req.body?.name, 160, 'Nombre del grupo', true);
    const grade = boundedText(req.body?.grade, 80, 'Grado');
    const row = (await db.query('INSERT INTO groups(id,owner_id,name,grade) VALUES($1,$2,$3,$4) RETURNING *', [randomUUID(), req.user.id, name, grade])).rows[0];
    res.status(201).json({ group: groupDto(row) });
  });
  router.get('/groups/:id/students', teacher, async (req, res) => {
    await ownedGroup(db, req.user.id, req.params.id);
    const rows = (await db.query(`SELECT student.id,student.username,student.name,student.role,student.disabled
      FROM users student JOIN enrollments enrollment ON enrollment.student_id=student.id WHERE enrollment.group_id=$1 ORDER BY student.name`, [req.params.id])).rows;
    res.json({ students: rows.map(studentDto) });
  });
  router.post('/groups/:id/students', teacher, async (req, res) => {
    const user = await db.transaction(async tx => {
      await ownedGroup(tx, req.user.id, req.params.id, true);
      let user;
      if (req.body?.studentId) {
        user = (await tx.query("SELECT * FROM users WHERE id=$1 AND owner_id=$2 AND role='student' AND disabled=FALSE", [req.body.studentId, req.user.id])).rows[0];
        if (!user) fail(404, 'Estudiante no encontrado.');
      } else {
        user = await auth.createUser({ username: req.body?.username, name: req.body?.name, password: req.body?.password, role: 'student', ownerId: req.user.id }, tx);
      }
      await tx.query('INSERT INTO enrollments(group_id,student_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [req.params.id, user.id]);
      return user;
    });
    res.status(201).json({ student: studentDto(user) });
  });

  router.get('/activities', teacher, async (req, res) => {
    const rows = (await db.query('SELECT * FROM activities WHERE owner_id=$1 ORDER BY created_at DESC', [req.user.id])).rows;
    res.json({ activities: rows.map(row => activityDto(row, { teacher: true })) });
  });
  router.post('/activities/seed', teacher, async (req, res) => {
    const source = seedActivity();
    const previous = (await db.query('SELECT * FROM activities WHERE owner_id=$1 AND source->>\'filename\'=$2 ORDER BY created_at LIMIT 1', [req.user.id, source.source.filename])).rows[0];
    const activity = previous || await insertActivity(db, req.user.id, source);
    res.status(previous ? 200 : 201).json({ activity: activityDto(activity, { teacher: true }) });
  });
  router.post('/activities', teacher, async (req, res) => {
    const row = await insertActivity(db, req.user.id, req.body);
    res.status(201).json({ activity: activityDto(row, { teacher: true }) });
  });
  router.get('/activities/:id', teacher, async (req, res) => {
    res.json({ activity: activityDto(await ownedActivity(db, req.user.id, req.params.id), { teacher: true }) });
  });
  router.patch('/activities/:id', teacher, async (req, res) => {
    res.json({ activity: activityDto(await updateActivity(db, req.user.id, req.params.id, req.body), { teacher: true }) });
  });
  router.post('/activities/:id/publish', teacher, async (req, res) => {
    res.json({ activity: activityDto(await publishActivity(db, req.user.id, req.params.id, req.body?.reviewed), { teacher: true }) });
  });
  router.post('/activities/:id/clone', teacher, async (req, res) => {
    const old = await ownedActivity(db, req.user.id, req.params.id);
    const cloned = await insertActivity(db, req.user.id, activityDto(old, { teacher: true }), old);
    res.status(201).json({ activity: activityDto(cloned, { teacher: true }) });
  });

  router.get('/assignments', async (req, res) => {
    const teacherView = req.user.role === 'teacher';
    const rows = (await db.query(`SELECT assignment.id,assignment.group_id,assignment.activity_id,assignment.created_at,
      g.name AS group_name,activity.title AS activity_title,activity.version,
      ${teacherView ? 'NULL::text AS attempt_id,NULL::text AS attempt_status' : 'atp.id AS attempt_id,atp.status AS attempt_status'}
      FROM assignments assignment JOIN groups g ON g.id=assignment.group_id JOIN activities activity ON activity.id=assignment.activity_id
      ${teacherView ? '' : 'JOIN enrollments e ON e.group_id=g.id LEFT JOIN attempts atp ON atp.assignment_id=assignment.id AND atp.student_id=e.student_id'}
      WHERE ${teacherView ? 'assignment.owner_id=$1' : "e.student_id=$1 AND activity.status='published'"} ORDER BY assignment.created_at DESC`, [req.user.id])).rows;
    res.json({ assignments: rows.map(row => ({ id: row.id, groupId: row.group_id, groupName: row.group_name, activityId: row.activity_id,
      activityTitle: row.activity_title, version: row.version, createdAt: row.created_at, attemptId: row.attempt_id, status: row.attempt_status })) });
  });
  router.post('/assignments', teacher, async (req, res) => {
    const groupId = boundedText(req.body?.groupId, 100, 'Grupo', true);
    const activityId = boundedText(req.body?.activityId, 100, 'Actividad', true);
    await ownedGroup(db, req.user.id, groupId);
    const activity = await ownedActivity(db, req.user.id, activityId);
    if (activity.status !== 'published') fail(409, 'Publica una versión revisada antes de asignarla.');
    const row = (await db.query(`INSERT INTO assignments(id,owner_id,group_id,activity_id) VALUES($1,$2,$3,$4)
      ON CONFLICT(group_id,activity_id) DO UPDATE SET activity_id=EXCLUDED.activity_id RETURNING *`, [randomUUID(), req.user.id, groupId, activityId])).rows[0];
    res.status(201).json({ assignment: { id: row.id, groupId: row.group_id, activityId: row.activity_id, createdAt: row.created_at } });
  });
  router.post('/assignments/:id/attempt', student, async (req, res) => {
    const view = await beginAttempt(db, req.user, req.params.id);
    view.tutor.available = typeof tutor === 'function';
    res.json(view);
  });
  router.get('/attempts/:id', async (req, res) => res.json(await attemptView(req.user, req.params.id)));
  router.patch('/attempts/:id', student, async (req, res) => {
    const view = await saveAttempt(db, req.user, req.params.id, req.body);
    view.tutor.available = typeof tutor === 'function';
    res.json(view);
  });
  router.post('/attempts/:id/submit', student, async (req, res) => {
    const view = await submitAttempt(db, req.user, req.params.id);
    view.tutor.available = typeof tutor === 'function';
    res.json(view);
  });
  router.post('/attempts/:id/review', teacher, async (req, res) => res.json(await reviewAttempt(db, req.user, req.params.id, req.body)));
  router.post('/attempts/:id/tutor', student, async (req, res) => {
    const result = await sendTutor(db, req.user, req.params.id, req.body, tutor);
    res.status(result.state === 'pending' ? 202 : 200).json(result);
  });
  router.get('/results', teacher, async (req, res) => {
    const params = [req.user.id];
    const filter = req.query.assignmentId ? (params.push(boundedText(req.query.assignmentId, 100, 'Asignación', true)), ' AND assignment.id=$2') : '';
    const rows = (await db.query(`SELECT atp.id,atp.assignment_id,atp.student_id,student.name AS student_name,student.username AS student_username,
      g.name AS group_name,activity.title AS activity_title,atp.status,atp.objective_score,atp.max_objective,atp.submitted_at,
      activity.content->'questions' AS questions,atp.answers,
      assessment.rubric,assessment.feedback FROM attempts atp JOIN assignments assignment ON assignment.id=atp.assignment_id
      JOIN users student ON student.id=atp.student_id JOIN groups g ON g.id=assignment.group_id JOIN activities activity ON activity.id=assignment.activity_id
      LEFT JOIN assessments assessment ON assessment.attempt_id=atp.id WHERE assignment.owner_id=$1${filter} ORDER BY atp.created_at DESC LIMIT 500`, params)).rows;
    res.json({ results: rows.map(row => ({ attemptId: row.id, assignmentId: row.assignment_id, studentId: row.student_id, studentName: row.student_name,
      studentUsername: row.student_username, groupName: row.group_name, activityTitle: row.activity_title, status: row.status, objectiveScore: row.objective_score,
      maxObjective: row.max_objective,
      alternatives: ['submitted', 'reviewed'].includes(row.status) ? summarizeAlternatives(row.questions, row.answers) : null,
      submittedAt: row.submitted_at, assessment: row.rubric ? { rubric: row.rubric, feedback: row.feedback, badges: badgesFor(row.rubric) } : null })) });
  });
  return router;
}
