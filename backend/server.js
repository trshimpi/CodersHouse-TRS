require("dotenv").config();

const express = require("express");
const path = require("path");
const app = express();
const DbConnect = require("./database");
const router = require("./routes");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const ACTIONS = require("./actions");

const server = require("http").createServer(app); // for socket

const io = require("socket.io")(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.use(cookieParser());
const corsOption = {
  credentials: true,
  //   origin: ["http://localhost:3000"],
};
app.use(cors(corsOption));
app.use("/storage", express.static("storage"));

const PORT = process.env.PORT || 5500;
DbConnect();
app.use(express.json({ limit: "8mb" }));
app.use(router);

const __dirname1 = path.resolve();
app.use(express.static(path.join(__dirname1, "/frontend/build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname1, "/frontend/build/index.html"));
});

// app.get('/',(req,res)=>{
//     res.send('hello from express');
// });

// sockets

const socketUserMapping = {};

io.on("connection", (socket) => {
  console.log("new connection ", socket.id);

  socket.on(ACTIONS.JOIN, ({ roomId, user }) => {
    socketUserMapping[socket.id] = user;

    // returns a Map , hence convert to array
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);

    // we'll get socketid of every client and send them an event
    // to add peer (for peer to peer connection offer<->answer)

    clients.forEach((clientId) => {
      // we are asking other clients to start peer to peer connection with us (current socket: socket.id)
      // in short we are sending our socketid to clients and asking then to add us as remote by accepting our offer and sending us the answer
      io.to(clientId).emit(ACTIONS.ADD_PEER, {
        peerId: socket.id,
        createOffer: false,
        user,
      });

      // we are emitting this event to ourself to create offers for all the other peers
      // and thus we are sending the id of corresponding client and userid of corresponding client to create an offer
      socket.emit(ACTIONS.ADD_PEER, {
        peerId: clientId,
        createOffer: true,
        user: socketUserMapping[clientId],
      });
    });

    socket.join(roomId);
  });

  // handle relay ice
  socket.on(ACTIONS.RELAY_ICE, ({ peerId, icecandidate }) => {
    // we just have to forward this icecandidate to corresponding peer
    // data : peerId = whose ice candidate are we sending ? socket.id  i.e.the one who is creating offer
    io.to(peerId).emit(ACTIONS.ICE_CANDIDATE, {
      peerId: socket.id,
      icecandidate,
    });
  });

  // handle relay sdp (sessionDescription)
  socket.on(ACTIONS.RELAY_SDP, ({ peerId, sessionDescription }) => {
    // data : peerId = whose session description are we sending ? (same explanation as above)
    io.to(peerId).emit(ACTIONS.SESSION_DESCRIPTION, {
      peerId: socket.id,
      sessionDescription,
    });
  });

  // Handle mute/unmute
  socket.on(ACTIONS.MUTE, ({ roomId, userId }) => {
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    clients.forEach((clientId) => {
      io.to(clientId).emit(ACTIONS.MUTE, {
        peerId: socket.id,
        userId,
      });
    });
  });

  socket.on(ACTIONS.UN_MUTE, ({ roomId, userId }) => {
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    clients.forEach((clientId) => {
      io.to(clientId).emit(ACTIONS.UN_MUTE, {
        peerId: socket.id,
        userId,
      });
    });
  });

  // Leaving the room
  const leaveRoom = ({ roomId }) => {
    // get all the rooms of a user;
    const { rooms } = socket;
    Array.from(rooms).forEach((roomId) => {
      const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);

      clients.forEach((clientId) => {
        // tell all the peer connections to remove us/me
        io.to(clientId).emit(ACTIONS.REMOVE_PEER, {
          peerId: socket.id,
          userId: socketUserMapping[socket.id]?.id,
        });

        // also remove all the clients from our peer connection (of particular room ofc)
        socket.emit(ACTIONS.REMOVE_PEER, {
          peerId: clientId,
          userId: socketUserMapping[clientId]?.id,
        });
      });

      // at the end leave room
      socket.leave(roomId);
    });
    delete socketUserMapping[socket.id];
  };

  socket.on(ACTIONS.LEAVE, leaveRoom);

  // listen to browser close
  socket.on("disconnecting", leaveRoom);
});

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
