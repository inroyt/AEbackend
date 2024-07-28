const express = require('express');
const expressWs = require('express-ws');
const router = express.Router();
const app = express();
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
// Create a WebSocket server using express-ws
const wsInstance = expressWs(app);

// Get the WebSocket server instance from express-ws
const wss = wsInstance.getWss();

// Create a Map to store client IDs associated with users
const userClientIds = new Map();

// Create a Set to store connected users
const connectedUsers = new Set();

// Function to generate a unique client ID
function generateClientId() {
  return uuidv4();
}

router.ws('/chat', (ws, req) => {
  const userId = req.query.userId;
  //console.log(`WebSocket connected for user ID: ${userId}`);

  // Store the WebSocket connection with the user ID
  userClientIds.set(userId, ws);
  connectedUsers.add(userId);
  connectedUsers.delete(undefined);
  // const userList = Array.from(connectedUsers).join("','");
  //console.log(`Connected users: '${userList}'`);

  ws.on('message', (message) => {
   // console.log(`Received message: ${message}`);

    try {
      const receivedMessage = JSON.parse(message);
     // console.log('Parsed message:', receivedMessage);

      const receiverName = receivedMessage.receiver;
      const receiverWs = userClientIds.get(receiverName);

      if (receiverWs) {
       // console.log(`Sending message to receiver: ${receiverName}`);
        receiverWs.send(JSON.stringify(receivedMessage));
      } /**
      else {
        // console.log(`Receiver '${receiverName}' is not connected.`);
        // Handle the case where the receiver is not connected
        // You may choose to notify the sender or handle it differently
      }
      */
    } catch (error) {
      console.error('Error parsing JSON:', error);
    }
  });

  ws.on('close', () => {
   // console.log(`WebSocket connection closed for user ID: ${userId}`);

    // Remove the WebSocket connection and user from the sets
    userClientIds.delete(userId);
    connectedUsers.delete(userId);
    //const userList = Array.from(connectedUsers).join("','");
   // console.log(`Connected users: '${userList}'`);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});


module.exports = router;
