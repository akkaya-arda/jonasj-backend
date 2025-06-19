const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const cors = require("cors");
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}));

// Socket.io başlatırken CORS ayarı
const io = new Server(server, {
    cors: {
        origin: "https://jonasj.vercel.app/",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Aktif Streamer'ları burada tutacağız
const activeStreamers = new Map(); // Map <socketId, userData>
const activeClients = new Map();
// REST API - Aktif streamer listesi
app.get('/api/streamers', (req, res) => {
    const streamers = Array.from(activeStreamers.values());
    res.json({ streamers });
});

// Socket.io bağlantısı
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Client "register" eventi ile kendini tanımlar (rolünü gönderir)
    socket.on('register', (userData) => {
        console.log(`Register: ${socket.id}`, userData);

        // { username: "Ali", role: "Streamer" }
        if (userData.role === 'Streamer') {
            activeStreamers.set(socket.id, { socketId: socket.id, username: userData.username });
            console.log(`Streamer added: ${userData.username}`);
        }

        if (userData.role === 'User') {
            console.log("Active client setting up.")
            activeClients.set(socket.id, { socketId: socket.id, username: userData.username, peerId: null });
        }

        // İsteğe bağlı: tüm client’lara güncel streamer listesi yayınlamak istersen:
        // io.emit('streamer_list_update', Array.from(activeStreamers.values()));
    });

    // Client bir Streamer'a arama göndermek ister
    socket.on('call_streamer', ({targetSocketId, callerSocketId, callerName}) => {
        console.log('Calling: ' + targetSocketId + " - " + callerSocketId + " [" + callerName + "]");
        let peerId = activeClients.get(socket.id).peerId;

        io.to(targetSocketId).emit('call_from_user', ({callerSocketId, callerName, peerId}));
    });

    // Disconnect olunca listeden çıkar
    socket.on('disconnect', () => {
        if (activeStreamers.has(socket.id)) {
            console.log(`Streamer disconnected: ${socket.id}`);
            activeStreamers.delete(socket.id);

            // Yine istersek güncel listeyi yayınlayabiliriz
            // io.emit('streamer_list_update', Array.from(activeStreamers.values()));
        }

        console.log(`User disconnected: ${socket.id}`);
    });

    socket.on('peer_id', (peerId) => {
        console.log(activeClients, socket.id);
        let clientData = activeClients.get(socket.id);
        clientData.peerId = peerId;
        activeClients.set(socket.id, clientData);
    })
});

// Server başlat
server.listen(PORT, () => {
    console.log('listening on *' + PORT);
});
