require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { Client } = require("pg");

const app = express();
const PORT = process.env.PORT || 80;

// Allow all origins during development (simpler than chasing IPs)
const path = require("path");

// Serve frontend from /public
app.use(express.static(path.join(__dirname, "public")));

// Fallback to index.html for root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
// Database connection
const client = new Client({
  host: process.env.DB_HOST || "taskboard-db-instance-0.cjkygowy4rs2.us-east-1.rds.amazonaws.com", 
  user: process.env.DB_USER || "taskuser",
  password: process.env.DB_PASS || "taskpass",
  database: process.env.DB_NAME || "taskboard",
});

client.connect()
  .then(() => console.log("Connected to DB"))
  .catch(err => console.error("DB connection error:", err));


client.query(`
  CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    due_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
`).then(() => console.log("Ensured tasks table exists"))
  .catch(err => console.error("Error ensuring tasks table:", err));

// Health checkaws
app.get("/ping", (req, res) => {
  res.json({ msg: "pong" });
});

// --- Task endpoints ---
app.get("/tasks", async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM tasks ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

app.get("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await client.query("SELECT * FROM tasks WHERE id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Task not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

app.post("/tasks", async (req, res) => {
  try {
    const { title, description, status, due_date } = req.body;
    const result = await client.query(
      `INSERT INTO tasks (title, description, status, due_date) 
       VALUES ($1, $2, COALESCE($3, 'pending'), $4) 
       RETURNING *`,
      [title, description, status, due_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

app.put("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, due_date } = req.body;
    const result = await client.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           due_date = COALESCE($4, due_date),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [title, description, status, due_date, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Task not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update task" });
  }
});

app.delete("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await client.query("DELETE FROM tasks WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Task not found" });
    res.json({ msg: "Task deleted", task: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

app.listen(PORT, "0.0.0.0", () => console.log(`Backend running on port ${PORT}`));
