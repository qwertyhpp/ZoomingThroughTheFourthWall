const express = require("express");
const app = express();
const https = require('https');
const fs = require('fs');
const port = 8080;
const SocketEvents = require('./socketevents');
const { Server } = require('socket.io');
const { ExpressPeerServer } = require('peer');
const production = false;

// Get the key and certificate require for HTTPS
const credentials = {
  key: fs.readFileSync('keys/key.pem'),
  cert: fs.readFileSync('keys/cert.pem')
};

// Create an HTTPS server with the given credentials and Express instance
const server = https.createServer(credentials, app);
const peerServer = ExpressPeerServer(server, { debug: true});
const io = new Server(server);

if (production == true)
  app.use(express.static(path.join(__dirname, '/public/build')));

// Serve different responses depending on whether production is enabled or not
app.get('/', (_request, response) => {
    if (production == false)
        response.send('The server is indeed working.')
    else
        response.send(path.join(__dirname, '/public/build/index.html'))
});

app.use('/peerjs', peerServer);

io.on(SocketEvents.Connection, (socket) => {
  console.log('A user has connected.');

  socket.on(SocketEvents.Disconnect, () => {
    console.log('A user has disconnected.')
  });

  socket.on(SocketEvents.CreateRoom, (roomName) => {
    if (!roomName) {
      callback({ status: "Failed", error: "Room name not provided." })
      return;
    }

    const rooms = io.of("/").adapter.rooms;

    // Return error if room duplication attempted.
    if (!rooms.has(roomName)) {
      callback({ status: "Failed", error: "Room with that name already exists." });
      return;
    }
    
    // Join creates a new room if one doesn't already exist with this name
    socket.join(roomName)
  })
  
  socket.on(SocketEvents.JoinRoom, (roomID) => {
    if (!roomID) {
      callback({ status: "Failed", error: "RoomID not provided." })
      return;
    }
    
    socket.join(roomID)
  });

  socket.on(SocketEvents.LeaveRoom, () => {
    
  });

  socket.on(SocketEvents.NewMessage, (author, message) => {
    // Save message to database and notify all other clients in room
    socket.broadcast.emit(SocketEvents.NewMessage, author, message)

    callback({ status: "accepted" })
  });
});

// Notify members of given room when client joins
io.of("/").adapter.on("join-room", (room, id) => {
  // Do not notify room members if it is the socket's default room
  if (room === id)
    return;
  
  io.to(room).emit(SocketEvents.UserJoinedRoom, id)
});

// Notify members of given room when client leaves
io.of("/").adapter.on("leave-room", (room, id) => {
  // Do not notify room members if it is the socket's default room
  if (room === id)
    return;
  
  io.to(room).emit(SocketEvents.UserLeftRoom, id)
})

app.listen(port, () => {
    console.log(`Fourth Wall listening on port ${port}`)
}); 