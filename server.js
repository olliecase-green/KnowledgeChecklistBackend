import { Application } from "https://deno.land/x/abc@v1.3.3/mod.ts";
import { DB } from "https://deno.land/x/sqlite@v2.5.0/mod.ts";
import { abcCors } from "https://deno.land/x/cors/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import { v4 } from "https://deno.land/std/uuid/mod.ts";

const app = new Application();
const db = new DB("./knowledge_checklist.db");
const PORT = 8080;
const allowedHeaders = ["Authorization", "Content-Type", "Accept", "Origin", "User-Agent"];

app
  .use(allowCors())
  .get("/:user_id/LOs", getLOs)
  .get("/cohorts/:cohort_id/LOs", getCohortLOs)
  .get("/cohorts", getCohorts)
  .post("/postLO", postLO)
  .get("/students/:cohort_id/results", getStudents)
  .get("/student/:user_id/data", getStudentData)
  .post("/users", postSignup)
  .post("/sessions", postLogin)
  .post("/:user_id/LOs", postScore)
  .delete("/deleteLOs", deleteLOs)
  .start({ port: PORT });
console.log(`Server running on http://localhost:${PORT}`);

function allowCors() {
  return abcCors({
    origin: `http://localhost:3000`,
    headers: allowedHeaders,
    credentials: true,
  });
}

async function getLOs(server) {
  const { user_id } = await server.params;
  const query = `
    SELECT *
    FROM results
    WHERE user_id = ?
  `;

  const LOs = [...(await db.query(query, [user_id])).asObjects()];

  if (LOs.length !== 0) {
    return server.json(LOs, 200);
  } else {
    return server.json({ error: "Student does not exist" }, 400);
  }
}

async function getStudents(server) {
  const { cohort_id } = await server.params;
  const query = `
    SELECT DISTINCT email, user_id
    FROM results
    WHERE cohort_id = ?
  `;
  const LOs = [...(await db.query(query, [cohort_id]).asObjects())];
  // if (LOs.length !== 0) {
  return server.json(LOs, 200);
  // } else {
  //   return server.json({ error: "Student does not exist" }, 400);
  // }
}

async function getStudentData(server) {
  const { user_id } = await server.params;
  const query = `
  SELECT *
  FROM results
  WHERE user_id = ?
  ORDER BY topic ASC
  `;
  const LOs = [...(await db.query(query, [user_id]).asObjects())];
  // if (LOs.length !== 0) {
  return server.json(LOs, 200);
  // } else {
  //   return server.json({ error: "Student does not exist" }, 400);
  // }
}

async function getCohortLOs(server) {
  const { cohort_id } = await server.params;
  const query = `
    SELECT *
    FROM learning_objectives
    WHERE cohort_id = ?
    ORDER BY topic ASC
  `;
  const cohortLOs = [...(await db.query(query, [cohort_id]).asObjects())];
  return server.json(cohortLOs);
}

async function getCohorts(server) {
  const query = `
    SELECT DISTINCT cohort_id 
    FROM learning_objectives
    ORDER BY cohort_id asc
  `;
  const cohorts = [...(await db.query(query).asObjects())];
  return server.json(cohorts, 200);
}

async function postLO(server) {
  const { cohort_id, topic, learning_objective } = await server.body;
  const query = `
    INSERT INTO learning_objectives(cohort_id, topic, learning_objective)
    VALUES (?, ?, ?)
  `;
  db.query(query, [cohort_id, topic, learning_objective]);

  const check = [
    ...db.query(
      "SELECT DISTINCT(users.email), users.cohort_id, users.id FROM learning_objectives JOIN users ON users.cohort_id = learning_objectives.cohort_id WHERE users.cohort_id=?",
      [cohort_id]
    ),
  ];

  check.forEach((i) =>
    db.query(`INSERT INTO results (user_id,email,cohort_id,topic,learning_objective) VALUES ('${i[2]}','${i[0]}','${i[1]}',?,?)`, [
      topic,
      learning_objective,
    ])
  );
}
function validateEmail(email) {
  if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    return true;
  }
  return false;
}
async function postSignup(server) {
  const { email, password, cohort_id } = await server.body;
  const salt = await bcrypt.genSalt(8);
  const passwordEncrypted = await bcrypt.hash(password, salt);

  if (!validateEmail(email)) {
    return server.json({ error: "Enter valid email" }, 400);
  }

  const checkRepeatEmails = [...db.query("SELECT COUNT(*) FROM users WHERE email = ?", [email])];

  if (checkRepeatEmails[0][0]) {
    return server.json({ error: "Email already in use" }, 400);
  }

  db.query(
    "INSERT INTO users (email, cohort_id, encrypted_password, created_at, updated_at, admin) VALUES (?, ?,?, datetime('now'), datetime('now'), false)",
    [email, cohort_id, passwordEncrypted]
  );

  const check = [
    ...db.query(
      "SELECT users.id, users.email,users.cohort_id,learning_objectives.topic,learning_objectives.learning_objective FROM learning_objectives JOIN users ON users.cohort_id = learning_objectives.cohort_id WHERE users.email =?",
      [email]
    ),
  ];
  check.forEach((i) =>
    db.query(`INSERT INTO results (user_id,email,cohort_id,topic,learning_objective) VALUES ('${i[0]}','${i[1]}','${i[2]}','${i[3]}','${i[4]}')`)
  );

  server.json({ success: true }, 200);
}

async function postLogin(server) {
  const { email, password } = await server.body;
  const authenticated = [...db.query("SELECT * FROM users WHERE email = ?", [email]).asObjects()];
  if (authenticated.length && (await bcrypt.compare(password, authenticated[0].encrypted_password))) {
    makeSession(authenticated[0].id, authenticated[0].email, server, authenticated[0].admin);
    server.json({ success: true });
  } else {
    server.json({ success: false });
  }
}

async function postScore(server) {
  const { userID, LO, score } = await server.body;

  db.query(`UPDATE results SET score = ? WHERE user_id = ? AND learning_objective = ?`, [score, userID, LO]);

  const LOs = [...db.query("SELECT * FROM results WHERE user_id = ?", [userID]).asObjects()];

  console.log(LOs);

  return server.json({ LOs: LOs }, 200);
}

async function makeSession(userID, e, server, isAdmin) {
  const sessionID = v4.generate();
  await db.query(`INSERT INTO sessions (id, user_id, email, created_at, isAdmin) VALUES (?, ?, ?, datetime('now'), ?)`, [
    sessionID,
    userID,
    e,
    isAdmin,
  ]);
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 1);
  server.setCookie({
    name: "sessionId",
    value: sessionID,
    expires: expiryDate,
  });
  server.setCookie({ name: "userID", value: userID, expires: expiryDate });
  server.setCookie({ name: "email", value: e, expires: expiryDate });
  server.setCookie({ name: "isAdmin", value: isAdmin, expiryDate });
}

async function deleteLOs(server) {
  const { learning_objective, cohort_id } = await server.body;
  const query = `DELETE FROM learning_objectives WHERE learning_objective = ? AND cohort_id = ?`;
  const query2 = `DELETE FROM results WHERE learning_objective = ? AND cohort_id = ?`;

  await db.query(query, [learning_objective, cohort_id]);
  await db.query(query2, [learning_objective, cohort_id]);
  server.json({ success: true }, 200);
}
