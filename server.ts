import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import multer from "multer";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("vibemeet.db");

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    PRIMARY KEY(workspace_id, user_id),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
  );

  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
  );

  CREATE TABLE IF NOT EXISTS team_members (
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY(team_id, user_id),
    FOREIGN KEY(team_id) REFERENCES teams(id)
  );

  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    team_id TEXT,
    name TEXT NOT NULL,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY(team_id) REFERENCES teams(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    text TEXT,
    file_url TEXT,
    file_name TEXT,
    file_type TEXT,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY(channel_id) REFERENCES channels(id)
  );
`);

// Seed default workspace if empty
const workspaceCount = db.prepare("SELECT count(*) as count FROM workspaces").get() as { count: number };
if (workspaceCount.count === 0) {
  const wsId = "default-workspace";
  db.prepare("INSERT INTO workspaces (id, name) VALUES (?, ?)").run(wsId, "Main Workspace");
  db.prepare("INSERT INTO channels (id, workspace_id, name) VALUES (?, ?, ?)").run("general", wsId, "General");
  db.prepare("INSERT INTO channels (id, workspace_id, name) VALUES (?, ?, ?)").run("engineering", wsId, "Engineering");
  db.prepare("INSERT INTO channels (id, workspace_id, name) VALUES (?, ?, ?)").run("marketing", wsId, "Marketing");
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const PORT = Number(process.env.PORT ?? 5173);

  app.use(express.json());
  app.use("/uploads", express.static(uploadsDir));

  // Multer config for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  });
  const upload = multer({ storage });

  // API Routes for multi-tenancy
  app.post("/api/workspaces", (req, res) => {
    const { id, name } = req.body;
    try {
      db.prepare("INSERT INTO workspaces (id, name) VALUES (?, ?)").run(id, name);
      res.json({ id, name, channels: [] });
    } catch (err) {
      res.status(400).json({ error: "Workspace ID already exists" });
    }
  });

  app.get("/api/workspaces/:id", (req, res) => {
    let workspace = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(req.params.id) as any;
    
    if (!workspace) {
      const wsId = req.params.id;
      const wsName = wsId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      db.prepare("INSERT INTO workspaces (id, name) VALUES (?, ?)").run(wsId, wsName);
      db.prepare("INSERT INTO channels (id, workspace_id, name) VALUES (?, ?, ?)").run(`${wsId}-general`, wsId, "General");
      db.prepare("INSERT INTO channels (id, workspace_id, name) VALUES (?, ?, ?)").run(`${wsId}-engineering`, wsId, "Engineering");
      workspace = { id: wsId, name: wsName };
    }
    
    const channels = db.prepare("SELECT * FROM channels WHERE workspace_id = ?").all(req.params.id);
    const teams = db.prepare("SELECT * FROM teams WHERE workspace_id = ?").all(req.params.id);
    const members = db.prepare("SELECT * FROM workspace_members WHERE workspace_id = ?").all(req.params.id);
    
    res.json({ ...workspace, channels, teams, members });
  });

  app.post("/api/workspaces/:id/members", (req, res) => {
    const { userId, userName, role } = req.body;
    try {
      db.prepare("INSERT OR REPLACE INTO workspace_members (workspace_id, user_id, user_name, role) VALUES (?, ?, ?, ?)")
        .run(req.params.id, userId, userName, role || 'member');
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: "Failed to add member" });
    }
  });

  app.post("/api/teams", (req, res) => {
    const { workspaceId, name } = req.body;
    const id = `team-${Math.random().toString(36).substr(2, 9)}`;
    try {
      db.prepare("INSERT INTO teams (id, workspace_id, name) VALUES (?, ?, ?)").run(id, workspaceId, name);
      res.json({ id, workspace_id: workspaceId, name });
    } catch (err) {
      res.status(400).json({ error: "Failed to create team" });
    }
  });

  app.post("/api/channels", (req, res) => {
    const { workspaceId, teamId, name } = req.body;
    const id = `${workspaceId}-${name.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).substr(2, 4)}`;
    try {
      db.prepare("INSERT INTO channels (id, workspace_id, team_id, name) VALUES (?, ?, ?, ?)").run(id, workspaceId, teamId || null, name);
      res.json({ id, workspace_id: workspaceId, team_id: teamId, name });
    } catch (err) {
      res.status(400).json({ error: "Failed to create channel" });
    }
  });

  app.get("/api/channels/:id/messages", (req, res) => {
    const messages = db.prepare("SELECT * FROM messages WHERE channel_id = ? ORDER BY timestamp ASC LIMIT 100").all(req.params.id);
    res.json(messages);
  });

  app.post("/api/upload", upload.single("file"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.json({
      url: `/uploads/${req.file.filename}`,
      name: req.file.originalname,
      type: req.file.mimetype
    });
  });

  app.get("/api/debug/schema", (req, res) => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const schema: any = {};
    tables.forEach((t: any) => {
      schema[t.name] = db.prepare(`PRAGMA table_info(${t.name})`).all();
    });
    res.json(schema);
  });

  // Room state: Map<roomId, Set<WebSocket>>
  const rooms = new Map<string, Set<WebSocket>>();
  // User state: Map<WebSocket, { id: string, name: string, roomId: string, workspaceId: string }>
  const users = new Map<WebSocket, { id: string, name: string, roomId: string, workspaceId: string }>();

  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        const { type, payload } = message;

        switch (type) {
          case "join": {
            const { workspaceId, roomId, userId, userName } = payload;
            
            // Leave previous room if any
            leaveRoom(ws);

            // Join new room
            if (!rooms.has(roomId)) {
              rooms.set(roomId, new Set());
            }
            rooms.get(roomId)!.add(ws);
            users.set(ws, { id: userId, name: userName, roomId, workspaceId });

            // Notify others in the room
            broadcastToRoom(roomId, {
              type: "user-joined",
              payload: { userId, userName }
            }, ws);

            // Send current user list to the new user
            const roomUsers = Array.from(rooms.get(roomId)!)
              .map(client => users.get(client))
              .filter(u => u !== undefined);
            
            ws.send(JSON.stringify({
              type: "room-state",
              payload: { users: roomUsers }
            }));
            break;
          }

          case "signal": {
            const { targetId, signal, senderId } = payload;
            const targetWs = Array.from(users.entries())
              .find(([_, u]) => u.id === targetId)?.[0];

            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({
                type: "signal",
                payload: { senderId, signal }
              }));
            }
            break;
          }

          case "chat": {
            const user = users.get(ws);
            if (user) {
              const msgId = Math.random().toString(36).substr(2, 9);
              const timestamp = Date.now();
              
              // Persist message
              db.prepare("INSERT INTO messages (id, channel_id, user_id, user_name, text, timestamp) VALUES (?, ?, ?, ?, ?, ?)")
                .run(msgId, user.roomId, user.id, user.name, payload.text, timestamp);

              broadcastToRoom(user.roomId, {
                type: "chat",
                payload: {
                  id: msgId,
                  userId: user.id,
                  userName: user.name,
                  text: payload.text,
                  timestamp
                }
              });
            }
            break;
          }
        }
      } catch (err) {
        console.error("Error processing message:", err);
      }
    });

    ws.on("close", () => {
      leaveRoom(ws);
    });
  });

  function broadcastToRoom(roomId: string, message: any, excludeWs?: WebSocket) {
    const clients = rooms.get(roomId);
    if (clients) {
      const data = JSON.stringify(message);
      clients.forEach(client => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    }
  }

  function leaveRoom(ws: WebSocket) {
    const user = users.get(ws);
    if (user) {
      const { roomId, id, name } = user;
      const clients = rooms.get(roomId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          rooms.delete(roomId);
        } else {
          broadcastToRoom(roomId, {
            type: "user-left",
            payload: { userId: id, userName: name }
          });
        }
      }
      users.delete(ws);
    }
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
