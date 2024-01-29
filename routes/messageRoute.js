const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DATABASE_URI);
const db = client.db('assamemployment');
const message = db.collection('messages');
const profiles = db.collection('users');

router.post('/api/sendMessage', (req, res) => {// console.log(req.body);
    try{
        const rawMessage = req.body.message;
        const sender = rawMessage.sender;
        const receiver = rawMessage.receiver;
        const text=rawMessage.text;
        const timestamp=rawMessage.timestamp;
        const preciseMessage = {
          "sender": sender,
          "receiver": receiver,
          "text": text,
          "timestamp": timestamp,
          "isUnread":true // Store the timestamp in milliseconds since Unix epoch
      };//console.log("precise message",preciseMessage);
    message.insertOne(preciseMessage);
    res.json({ success: true });
    }catch(err){
        console.error('Error sending message:', err);
        res.status(500).send('Error sending message');
    }
    
  });
// API endpoint for retrieving messages between two users
router.get('/api/getMessages/:user1/:user2', async (req, res) => { console.log("getting conversations..."); 
  try {
    const { user1, user2 } = req.params;
    const page = parseInt(req.query.page) || 1; // Get page number from query parameter (default: 1)
    const perPage = 7; // Messages per page

    const messagesArray = await message
      .find({
        $or: [
          { sender: user1, receiver: user2 },
          { sender: user2, receiver: user1 },
        ],
        deletedForUsers: { $nin: [user1] }, // Exclude messages deleted for user1 or user2
      })
      .sort({ timestamp: -1 }) // Sort messages by descending timestamp
      .skip((page - 1) * perPage) // Skip messages for previous pages
      .limit(perPage) // Limit messages per page
      .toArray();

    messagesArray.reverse();
  // Update isUnread to false for the messages retrieved
  const updateUnreadPromises = messagesArray.map(async (msg) => {
    if (msg.isUnread===true) {
      // Update isUnread to false if it was true
      await message.updateOne({ _id: msg._id }, { $set: { isUnread: false } });
    }
  });

  await Promise.all(updateUnreadPromises);

    if (messagesArray.length > 0) {
      res.json(messagesArray);
    }
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).send('Error fetching messages');
  }
});
// API endpoint for retrieving inbox conversations
router.get('/api/inbox/:linkname', async (req, res) => {
  try {
    const { linkname } = req.params;

    // Find messages where the specified user is the sender or receiver and messages are not deleted
    const messagesArray = await message.find({
      $or: [
        { sender: linkname, deletedForUsers: { $nin: [linkname] } },
        { receiver: linkname, deletedForUsers: { $nin: [linkname] } },
      ],
    }).toArray();

    // Get unique list of other users
    const otherUsers = Array.from(new Set(messagesArray.map((message) =>
      (message.sender === linkname ? message.receiver : message.sender))));

    // Fetch the names, _id, and picture of other users from the 'users' collection
    const userInfos = await db.collection('users').find({ linkname: { $in: otherUsers } }).toArray();

    // Create a map for quick info lookup based on linkname
    const userInfoMap = {};
    userInfos.forEach((userInfo) => {
      userInfoMap[userInfo.linkname] = {
        _id: userInfo._id,
        name: userInfo.name,
        picture: userInfo.picture,
      };
    });

    // Group messages by user and get the last message for each user
    const conversations = messagesArray.reduce((acc, message) => {
      const otherUser = message.sender === linkname ? message.receiver : message.sender;

      const existingConversation = acc.find((conv) => conv.linkname === otherUser);

      if (!existingConversation) {
        acc.push({
          linkname: otherUser,
          ...userInfoMap[otherUser], // Include _id, name, and picture
          lastMessage: message.text,
          timestamp: message.timestamp,
          unreadCount: (linkname !== message.sender && message.isUnread) ? 1 : 0, // Check if the message is unread and sender is not the requester
        });
      } else {
        if (message.timestamp > existingConversation.timestamp) {
          existingConversation.lastMessage = message.text;
          existingConversation.timestamp = message.timestamp;

          if (linkname !== message.sender && message.isUnread) {
            existingConversation.unreadCount += 1;
          }
        }
      }

      return acc;
    }, []);

    // console.log(conversations);
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: 'Error retrieving inbox conversations' });
  }
});

    
    //  route to delete all messages between two users
    router.delete('/api/deleteMessages/:user1/:user2', async (req, res) => {
      try {
        const { user1, user2 } = req.params;
      
        // Find the messages between the two specified users
        const messages = await message.find({
          $or: [
            { sender: user1, receiver: user2 },
            { sender: user2, receiver: user1 },
          ],
        }).toArray();
    
        if (!messages || messages.length === 0) {
          return res.send({ success: false, message: `No messages found between ${user1} and ${user2}` });
        }
    
        // Determine the user initiating the deletion
        const initiatingUser = user1;
    
        // Update the 'deletedForUsers' array for each message
        const updatePromises = messages.map(async msg => {
          const updateObj = { $addToSet: { deletedForUsers: initiatingUser } };
    
          await message.updateOne({ _id: msg._id }, updateObj);
         
          // Check if both users are in the 'deletedForUsers' array, then delete the message
          const messageDoc = await message.findOne({ _id: msg._id }); console.log(messageDoc);
          const deletedForUsers = messageDoc.deletedForUsers || [];
    
          if (deletedForUsers.includes(user1) && deletedForUsers.includes(user2)) {
            // Both users have deleted the message, so remove it
            await message.deleteOne({ _id: msg._id });
          }
        });
    
        await Promise.all(updatePromises);
    
        res.send({ success: true, message: `Messages deleted for ${initiatingUser}` });
      } catch (error) {
        console.error('Error deleting messages:', error);
        res.status(500).send({ error: 'Error deleting messages' });
      }
    });
    
module.exports = router;

      

