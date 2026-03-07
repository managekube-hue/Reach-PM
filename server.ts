import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type PresenceStatus = "online" | "available" | "out_of_office" | "last_seen";

type ConnectedUser = {
  id: string;
  name: string;
  roomId: string;
  workspaceId: string;
  status: PresenceStatus;
  lastActiveAt: number;
};

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const rooms = new Map<string, Set<WebSocket>>();
  const users = new Map<WebSocket, ConnectedUser>();
  const HOST = process.env.HOST ?? "127.0.0.1";
  const PORT = Number(process.env.PORT ?? 5177);

  app.use(express.json());

  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        const { type, payload } = message;

        switch (type) {
          case "join": {
            const { workspaceId, roomId, userId, userName } = payload;
            leaveRoom(ws);

            if (!rooms.has(roomId)) {
              rooms.set(roomId, new Set());
            }
            rooms.get(roomId)!.add(ws);

            users.set(ws, {
              id: userId,
              name: userName,
              roomId,
              workspaceId,
              status: "online",
              lastActiveAt: Date.now(),
            });

            broadcastToRoom(
              roomId,
              {
                type: "user-joined",
                payload: { userId, userName },
              },
              ws
            );

            const roomUsers = Array.from(rooms.get(roomId)!)
              .map((client) => users.get(client))
              .filter((user): user is ConnectedUser => Boolean(user));

            ws.send(
              JSON.stringify({
                type: "room-state",
                payload: { users: roomUsers },
              })
            );
            break;
          }

          case "signal": {
            const { targetId, signal, senderId } = payload;
            const sender = users.get(ws);
            if (sender) {
              sender.lastActiveAt = Date.now();
              if (sender.status !== "out_of_office") {
                sender.status = "available";
              }
            }

            const targetWs = Array.from(users.entries()).find(([, user]) => user.id === targetId)?.[0];
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(
                JSON.stringify({
                  type: "signal",
                  payload: { senderId, signal },
                })
              );
            }
            break;
          }

          case "presence": {
            const user = users.get(ws);
            if (!user) {
              break;
            }
            const requested = payload?.status;
            if (
              requested === "online" ||
              requested === "available" ||
              requested === "out_of_office" ||
              requested === "last_seen"
            ) {
              user.status = requested;
            }
            user.lastActiveAt = Date.now();
            break;
          }

          default:
            break;
        }
      } catch (error) {
        console.error("Error processing websocket message:", error);
      }
    });

    ws.on("close", () => {
      leaveRoom(ws);
    });
  });

  function broadcastToRoom(roomId: string, message: unknown, excludeWs?: WebSocket) {
    const clients = rooms.get(roomId);
    if (!clients) {
      return;
    }

    const data = JSON.stringify(message);
    clients.forEach((client) => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  function leaveRoom(ws: WebSocket) {
    const user = users.get(ws);
    if (!user) {
      return;
    }

    const { roomId, id, name } = user;
    const clients = rooms.get(roomId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        rooms.delete(roomId);
      } else {
        broadcastToRoom(roomId, {
          type: "user-left",
          payload: { userId: id, userName: name },
        });
      }
    }

    users.delete(ws);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    if (HOST === "127.0.0.1") {
      console.log(`Also available via http://localhost:${PORT}`);
    }
  });
}

startServer();
