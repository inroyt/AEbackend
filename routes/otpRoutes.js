const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { snsClient } = require('../config/awsConfig'); // Adjust the path as needed
const { PublishCommand } = require('@aws-sdk/client-sns');
const { MongoClient, ObjectId } = require('mongodb');
const client = new MongoClient(process.env.DATABASE_URI);
const db = client.db('assamemployment');
const otpData = db.collection('OTP');
const forgotPassword = db.collection('forgotPassword');
const profiles = db.collection('users');
const router = express.Router();
const OTP_VALIDITY_PERIOD = 5 * 60 * 1000; // 5 minutes in milliseconds

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTP = async (phoneNumber, otp) => {
    const modifiedNumber = '+91'.concat(phoneNumber);
    const params = {
        Message: `Your OTP is: ${otp}`,
        PhoneNumber: modifiedNumber,
    };

    try {
        const data = await snsClient.send(new PublishCommand(params));
    } catch (error) {
        console.error('Error sending OTP:', error);
    }
};

// OTP request for applying
router.post('/api/request-otp/:postId', [
    param('postId').notEmpty().withMessage('Post ID is required'),
    body('phoneNumber').isMobilePhone('en-IN').withMessage('Invalid phone number')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array() });
    }

    const { phoneNumber } = req.body;
    const { postId } = req.params;
    const otp = generateOTP();
    const timestamp = new Date().getTime();
    const data = {
        phoneNumber: phoneNumber,
        postId: postId,
        otp: otp,
        timestamp: timestamp,
        verified: false
    };

    await sendOTP(phoneNumber, otp);
    await otpData.insertOne(data);

    res.status(200).send({ message: 'Please enter the OTP' });
});

// Verify OTP response
router.post('/api/verify-otp', [
    body('phoneNumber').isMobilePhone('en-IN').withMessage('Invalid phone number'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array() });
    }

    const { phoneNumber, otp } = req.body;
    const otpByNumber1 = await otpData.find({ phoneNumber: phoneNumber }).sort({ timestamp: -1 }).toArray();
    const otpByNumber = otpByNumber1[0];
    
    if (!otpByNumber) {
        return res.status(400).send({ message: 'OTP not found' });
    }

    const timestamp = otpByNumber.timestamp;
    const storedOtp = otpByNumber.otp;
    const currentTime = new Date().getTime();
    const timeDifference = currentTime - timestamp;

    if (timeDifference > OTP_VALIDITY_PERIOD) {
        return res.status(400).send({ message: 'OTP has expired' });
    }

    if (storedOtp === otp) {
        const otpDataId = otpByNumber._id;
        const editOtpResult = await otpData.updateOne(
            { _id: new ObjectId(otpDataId) },
            { $set: { verified: true } }
        );
        if (editOtpResult.modifiedCount === 0) {
            return res.status(500).send({ message: 'OTP could not be verified' });
        }
        res.status(200).send({ message: 'OTP verified successfully' });
    } else {
        res.status(400).send({ message: 'Invalid OTP' });
    }
});

// OTP request for forgot password
router.post('/api/request-otp-forgot-password', [
    body('phoneNumber').isMobilePhone('en-IN').withMessage('Invalid phone number')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array() });
    }

    const { phoneNumber } = req.body;
    const otp = generateOTP();
    const timestamp = new Date().getTime();
    const user = await profiles.findOne({ phone: phoneNumber });

    if (!user) {
        return res.status(404).send({ message: 'This phone number is not registered with any account on Assam Employment' });
    } else {
        const username = user.name;
        const userId = user._id;
        const data = {
            userId: userId,
            username: username,
            phoneNumber: phoneNumber,
            otp: otp,
            timestamp: timestamp,
            verified: false
        };
        await sendOTP(phoneNumber, otp);
        await forgotPassword.insertOne(data);
        res.status(200).send({ message: 'Please enter the OTP' });
    }
});

// Verify OTP response for resetting password
router.post('/api/verify-otp-forgot-password', [
    body('phoneNumber').isMobilePhone('en-IN').withMessage('Invalid phone number'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array() });
    }

    const { phoneNumber, otp } = req.body;
    const otpByNumber1 = await forgotPassword.find({ phoneNumber: phoneNumber }).sort({ timestamp: -1 }).toArray();
    const otpByNumber = otpByNumber1[0];
    
    if (!otpByNumber) {
        return res.status(400).send({ message: 'OTP not found' });
    }

    const timestamp = otpByNumber.timestamp;
    const storedOtp = otpByNumber.otp;
    const username = otpByNumber.username;
    const userId = otpByNumber.userId;
    const currentTime = new Date().getTime();
    const timeDifference = currentTime - timestamp;

    if (timeDifference > OTP_VALIDITY_PERIOD) {
        return res.status(400).send({ message: 'OTP has expired' });
    }

    if (storedOtp === otp) {
        const otpDataId = otpByNumber._id;
        const id = new ObjectId(otpDataId);
        const editOtpResult = await forgotPassword.updateOne(
            { _id: id },
            { $set: { verified: true } }
        );
        if (editOtpResult.modifiedCount === 0) {
            return res.status(500).send({ message: 'OTP could not be verified' });
        }
        res.status(200).send({ message: username, userId: userId });
    } else {
        res.status(400).send({ message: 'Invalid OTP' });
    }
});

module.exports = router;

