const express = require("express");
const http    = require("http");
const { Server } = require("socket.io");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

// ── Serve frontend ────────────────────────────────────────
app.use(express.static("public"));

// ── State ─────────────────────────────────────────────────
// Track connected users: socketId → { name, color }
const users = new Map();

// ── Socket.io ─────────────────────────────────────────────
io.on("connection", (socket) => {

  // Store placeholder until client sends name
  users.set(socket.id, { name: "Anonymous", color: "#888" });

  // Broadcast updated count
  broadcastCount();

  // Client sends their chosen username
  socket.on("set-name", (name) => {
    const safe = String(name).slice(0, 32).replace(/[^a-zA-Z0-9 _\-]/g, "");
    users.get(socket.id).name = safe || "Anonymous";

    // Notify others
    socket.broadcast.emit("user-joined", users.get(socket.id).name);
    console.log(`[+] ${users.get(socket.id).name} connected (${socket.id})`);
  });

  // Client sends their chosen color
  socket.on("set-color", (color) => {
    const safe = String(color).match(/^#[0-9a-fA-F]{6}$/) ? color : "#888";
    users.get(socket.id).color = safe;
  });

  // Chat message
  socket.on("chat message", (msg) => {
    const text = String(msg).slice(0, 500);
    if (!text.trim()) return;

    const user = users.get(socket.id);

    // Broadcast to everyone EXCEPT the sender
    socket.broadcast.emit("chat message", {
      name:  user.name,
      text,
      color: user.color,
    });

    console.log(`[msg] ${user.name}: ${text}`);
  });

  // Typing indicator
  socket.on("typing", () => {
    const user = users.get(socket.id);
    socket.broadcast.emit("typing", { name: user.name });
  });

  // Disconnect
  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`[-] ${user.name} disconnected`);
      io.emit("user-left", user.name);
      users.delete(socket.id);
      broadcastCount();
    }
  });
});

// ── Helpers ───────────────────────────────────────────────
function broadcastCount() {
  io.emit("online-count", users.size);
}

// ── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
