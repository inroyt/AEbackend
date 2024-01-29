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
  //console.log('WebSocket connected');

  const userId = req.query.userId;
  console.log(`WebSocket connected for user ID: ${userId}`);

  // Generate a client ID for the user if it doesn't exist
  let clientId = userClientIds.get(userId);
  if (!clientId) {
    clientId = generateClientId(); // Implement a function to generate unique client IDs
    userClientIds.set(userId, clientId);
  }

  // Associate the clientName with the WebSocket connection
  ws.clientName = userId;

  console.log(`Client ID: ${clientId}`);

  // Store the client ID with the WebSocket connection
  ws.clientId = clientId;
  wss.clients.add(ws);

  // Add the user to the list of connected users
  connectedUsers.add(userId);
  connectedUsers.delete(undefined);
  const userList = Array.from(connectedUsers).join("','");
  console.log(`Connected users: '${userList}'`);

  // Send a welcome message to the connected user
 // ws.send(`Welcome, ${userId}! Connected users: '${userList}'`);

  
  ws.on('message', (message) => {
    console.log(`Received message: ${message}`);
    //console.log(wss.clients);
    try {
      const receivedMessage = JSON.parse(message);
      console.log('Parsed message:', receivedMessage);

      // Find the WebSocket connection associated with the receiver's name
      const receiverName = receivedMessage.receiver;
      const receiverClient = Array.from(wss.clients).find((client) => {
        // Compare the receiver's name with the clientName property
        return client !== ws && client.clientName === receiverName;
      });
      console.log('Receiver client state:', receiverClient.readyState);
      if (receiverClient) {
        setTimeout(() => {
          if (receiverClient.readyState === WebSocket.OPEN) {
            console.log('Receiver Client is OPEN');
            // Send the message to the specific receiver
            receiverClient.send(JSON.stringify(receivedMessage));
          } else {
            console.log(`Receiver client is not in OPEN state`);
            // Handle the case where the receiver client is not in an OPEN state
          }
        }, 1000); // Adjust the timeout duration as needed
        
      }
    } catch (error) {
      console.error('Error parsing JSON:', error);
    }
  });
  ws.on('close', () => {
    // Remove the client's WebSocket connection when it is closed
    console.log(`Client ${clientId} disconnected`);
  
    // Mark the user as disconnected but wait for some time before fully removing them
    setTimeout(() => {
      if (!connectedUsers.has(userId)) {
        // Remove the user from the list of connected users
        connectedUsers.delete(userId);
        const userList = Array.from(connectedUsers).join("','");
        console.log(`Connected users: '${userList}'`);
      }
    }, 30000); // Adjust the timeout duration as needed
  });
  

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

module.exports = router;
