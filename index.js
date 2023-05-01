require("dotenv").config();
const express = require("express");
const app = express();
http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

app.use(cors()); //adding cors middleware

const server = http.createServer(app);

//creating an io server which allows for CORS from http://localhost:3002 with GET & POST methods
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    method: ["GET", "POST"],
  },
});

const CHAT_BOT = "ChatBot";
let chatRoom = "";
let allUsers = []; //All users in the current chatroom
//listen for when client connects via socket.io-client

const harperSaveMessage = require('./services/herper-save-message');
const harperGetMessages = require('./services/harper-get-messages');
const leaveRoom = require('./utils/leave-room');
io.on("connection", (socket) => {
  console.log(`User connected ${socket.id}`);

  //Adding user to a room
  socket.on("join_room", (data) => {
    const { username, room } = data; //destructuring the data sent through the join_room event from client
    socket.join(room); // join the user to a socket room

    let __createdtime__ = Date.now();
    //send message to all users currently in the room apart from the user that just joined
    socket.to(room).emit("receive_message", {
      message: `${username} has joined the chat room`,
      username: CHAT_BOT,
      __createdtime__,
    });

    //send a welcome message to newly joined users
    socket.emit("receive_message", {
      message: `Welcome ${username}`,
      username: CHAT_BOT,
      __createdtime__,
    });

    //save new users to the room
    chatRoom = room;
    allUsers.push({ id: socket.id, username, room });
    chatRoomUsers = allUsers.filter((user) => user.room === room);
    socket.to(room).emit("chatroom_users", chatRoomUsers);
    socket.emit("chatroom_users", chatRoomUsers);

    //get last 100 messages sent in the chat room
    harperGetMessages(room)
      .then((last100Messages) => {
        //console.log('latest messages', last100Messages);
        socket.emit('last_100_messages', last100Messages);
      })
      .catch((error) => console.log(error));
    
  });

  //listen to send_message and send message to all users
  socket.on('send_message', (data) => {
    const {message, username, room, __createdtime__} = data;
    //send message to all users including the sender
    io.in(room).emit('receive_message', data);
    //save message in harper db
    harperSaveMessage(message, username, room, __createdtime__)
        .then((response) => console.log(response))
        .catch((error) => console.log(error));
  });

  //leave room 
  socket.on('leave_room', (data) => {
    const {username, room} = data;
    socket.leave(room);
    const __createdtime__ = Date.now();
    //Remove user from memory
    allUsers = leaveRoom(socket.id, allUsers);
    socket.to(room).emit('chatroom_users', allUsers);
    socket.to(room).emit('receive_message', {
      username: CHAT_BOT,
      message: `${username} has left the chat`,
      __createdtime__,
    });
    console.log(`${username} has left the chat`);
  });

  //disconnect when there is an interruption in connection
  socket.on('disconnect', () => {
    console.log('User disconnected from the chat');
    const user = allUsers.find((user) => user.id == socket.id);
    if(user?.username){
      allUsers = leaveRoom(socket.id, allUsers);
      socket.to(chatRoom).emit('chatroom_users', allUsers);
      socket.to(chatRoom).emit('receive_message', {
        message: `${user.username} has disconnected from the chat.`,
      });
    }
  });
});


server.listen(4000, () =>
  console.log(`Server listening at port http://localhost:4000`)
);
