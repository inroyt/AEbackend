const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const client = new MongoClient(process.env.DATABASE_URI);
const db = client.db('assamemployment');
const profiles = db.collection('users');
const message = db.collection('messages');
const supportMsg = db.collection('support');

// Route to send a message
router.post('/api/sendMessage', [
  body('message.sender').notEmpty().withMessage('Sender is required'),
  body('message.receiver').notEmpty().withMessage('Receiver is required'),
  body('message.text').notEmpty().withMessage('Message text is required'),
  body('message.timestamp').isNumeric().withMessage('Timestamp must be a number')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array() });
  }

  try {
    const rawMessage = req.body.message;
    const sLinkname=rawMessage.sender
    const rLinkname=rawMessage.receiver
    const sender = await profiles.findOne({ linkname: sLinkname });
    const receiver = await profiles.findOne({ linkname: rLinkname });
    const senderId = sender._id.toString();
    const receiverId = receiver._id.toString();  
    if (!sender || !receiver) {
      return res.status(400).json({ message: 'Invalid sender or receiver ID' });
    }
    if (sender.blockedUsers.includes(receiverId) || receiver.blockedUsers.includes(senderId)) {
      return res.status(403).json({ message: 'Message cannot be sent. One of the users has blocked the other.' });
    }
    const preciseMessage = {
      sender: rawMessage.sender,
      receiver: rawMessage.receiver,
      text: rawMessage.text,
      timestamp: rawMessage.timestamp,
      isUnread: true
    };

    await message.insertOne(preciseMessage);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).send({ message: 'Error sending message' });
  }
});

// Route to get messages between two users
router.get('/api/getMessages/:user1/:user2', [
  param('user1').notEmpty().withMessage('User1 is required'),
  param('user2').notEmpty().withMessage('User2 is required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array() });
  }

  try {
    const { user1, user2 } = req.params;
    const page = parseInt(req.query.page) || 1;
    const perPage = 7;

    const messagesArray = await message
      .find({
        $or: [
          { sender: user1, receiver: user2 },
          { sender: user2, receiver: user1 }
        ],
        deletedForUsers: { $nin: [user1] }
      })
      .sort({ timestamp: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .toArray();

    messagesArray.reverse();

    const updateUnreadPromises = messagesArray.map(async (msg) => {
      if (msg.isUnread === true) {
        await message.updateOne({ _id: msg._id }, { $set: { isUnread: false } });
      }
    });

    await Promise.all(updateUnreadPromises);

    res.status(200).json(messagesArray);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Route to get inbox conversations
router.get('/api/inbox/:linkname', [
  param('linkname').notEmpty().withMessage('Linkname is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array() });
  }

  try {
    const { linkname } = req.params;

    const messagesArray = await message.find({
      $or: [
        { sender: linkname, deletedForUsers: { $nin: [linkname] } },
        { receiver: linkname, deletedForUsers: { $nin: [linkname] } }
      ]
    }).toArray();

    const otherUsers = Array.from(new Set(messagesArray.map((message) =>
      (message.sender === linkname ? message.receiver : message.sender))));

    const userInfos = await db.collection('users').find({ linkname: { $in: otherUsers } }).toArray();

    const userInfoMap = {};
    userInfos.forEach((userInfo) => {
      userInfoMap[userInfo.linkname] = {
        _id: userInfo._id,
        name: userInfo.name,
        picture: userInfo.picture
      };
    });

    const conversations = messagesArray.reduce((acc, message) => {
      const otherUser = message.sender === linkname ? message.receiver : message.sender;

      const existingConversation = acc.find((conv) => conv.linkname === otherUser);

      if (!existingConversation) {
        acc.push({
          linkname: otherUser,
          ...userInfoMap[otherUser],
          lastMessage: message.text,
          timestamp: message.timestamp,
          unreadCount: (linkname !== message.sender && message.isUnread) ? 1 : 0
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

    res.status(200).json(conversations);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving inbox conversations' });
  }
});

// Route to delete all messages between two users
router.delete('/api/deleteMessages/:user1/:user2', [
  param('user1').notEmpty().withMessage('User1 is required'),
  param('user2').notEmpty().withMessage('User2 is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array() });
  }

  try {
    const { user1, user2 } = req.params;

    const messages = await message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 }
      ]
    }).toArray();

    if (!messages || messages.length === 0) {
      return res.status(400).json({ success: false, message: `No messages found between ${user1} and ${user2}` });
    }

    const initiatingUser = user1;

    const updatePromises = messages.map(async msg => {
      const updateObj = { $addToSet: { deletedForUsers: initiatingUser } };

      await message.updateOne({ _id: msg._id }, updateObj);

      const messageDoc = await message.findOne({ _id: msg._id });
      const deletedForUsers = messageDoc.deletedForUsers || [];

      if (deletedForUsers.includes(user1) && deletedForUsers.includes(user2)) {
        await message.deleteOne({ _id: msg._id });
      }
    });

    await Promise.all(updatePromises);

    res.status(200).json({ success: true, message: `Messages deleted for ${initiatingUser}` });
  } catch (error) {
    console.error('Error deleting messages:', error);
    res.status(500).send({ message: 'Error deleting messages' });
  }
});

// Route to post support queries
router.post('/api/support', [
  body('email').notEmpty().withMessage('Sender Email is required'),
  body('query').notEmpty().withMessage('Query is required'),
  body('message').notEmpty().withMessage('Message is required'),
  body('timestamp').isInt({ gt: 0 }).withMessage('Timestamp must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array() });
  }

  try {
    const incomingQuery = req.body;
    await supportMsg.insertOne(incomingQuery);
    res.status(200).json({ message: "Support query sent successfully" });
  } catch (error) {
    console.error('Failed to insert the post:', error);
    res.status(500).json({ message: 'Failed to upload the post' });
  }
});

// Route to get support queries
router.get('/api/supportQueries', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array() });
  }

  const page = parseInt(req.query.page) || 1;
  const perPage = 5;

  try {
    const supportQueries = await supportMsg.find()
      .sort({ timestamp: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .toArray();

    res.status(200).json(supportQueries);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch queries' });
  }
});

// Route to delete a query
router.delete('/api/supportQueries/delete/:queryId', [
  param('queryId').isMongoId().withMessage('Invalid query ID')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array() });
  }

  const { queryId } = req.params;

  try {
    const deleteResult = await supportMsg.deleteOne({ _id: new ObjectId(queryId) });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({ message: 'Query not found or already deleted' });
    }

    res.status(200).json({ message: 'Query deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete query' });
  }
});

module.exports = router;
