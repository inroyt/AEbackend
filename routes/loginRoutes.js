const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const { body, validationResult } = require('express-validator');
const client = new MongoClient(process.env.DATABASE_URI);
const db = client.db('assamemployment');
const collection = db.collection('users');
const axios = require('axios');
const jwtDecode = require('jwt-decode');
const bcrypt = require('bcrypt');

const handleUser = async (rawUserData, preciseUserData, collection, req, res) => {
    preciseUserData = {
        "name": rawUserData.name,
        "email": rawUserData.email,
        "picture": rawUserData.picture,
        "savedPosts": [],
        "likedPosts": [],
        "followers": [],
        "following": [],
        "linkname": "",
        "id": rawUserData.id
    };
    const email = rawUserData.email;
    let duplicateUser = await collection.findOne({ email });
    const linkname = email.split('@')[0];
    preciseUserData.linkname = linkname.includes('.') ? linkname.replace(/\./g, '') : linkname;

    if (duplicateUser) {
        const isLinked = duplicateUser.hasOwnProperty("id");
        if (!isLinked) {
            const mergedAccount = { ...duplicateUser, id: rawUserData.id, picture: rawUserData.picture, name: rawUserData.name };
            await collection.replaceOne({ _id: duplicateUser._id }, mergedAccount);
            req.session.user = mergedAccount;
            req.session.save();
            res.status(200).json(req.session.user);
        } else {
            req.session.user = duplicateUser;
            req.session.save();
            res.status(200).json(req.session.user);
        }
    } else {
        await collection.insertOne(preciseUserData);
        req.session.user = preciseUserData;
        req.session.save();
        res.status(200).json(req.session.user);
    }
};

const handleRawUser = async (rawUserData, preciseUserData, collection, req, res) => {
    try {
        const hasEmail = rawUserData.hasOwnProperty("email");
        const hasPassword = rawUserData.hasOwnProperty("password");
        const hasName = rawUserData.hasOwnProperty("name");
        const name = rawUserData.name;
        const email = rawUserData.email;
        const pwd = rawUserData.password;
        const findUserByName = await collection.findOne({ name });
        const findUserByEmail = await collection.findOne({ email });

        if (hasEmail && hasPassword && hasName) { // for sign-up
            const hashedPassword = await bcrypt.hash(pwd, 10);
            preciseUserData = {
                "name": rawUserData.name,
                "email": rawUserData.email,
                "password": hashedPassword,
                "savedPosts": [],
                "linkname": "",
                "likedPosts": [],
                "followers": [],
                "following": []
            };
            const linkname = email.split('@')[0];
            preciseUserData.linkname = linkname.includes('.') ? linkname.replace(/\./g, '') : linkname;

            if (findUserByName || findUserByEmail) {
                const isLinked = findUserByEmail.hasOwnProperty("id");
                if (findUserByName) {
                    res.status(400).json({ message: "Sorry, the username you entered is already in use, please try a different username." });
                } else if (findUserByEmail && isLinked) {
                    res.status(400).json({ message: "You already have an account signed up with your google email, please login with your google account." });
                } else {
                    res.status(400).json({ message: "This email address is already in use, please enter a different email address." });
                }
            } else {
                await collection.insertOne(preciseUserData);
                req.session.user = preciseUserData;
                req.session.save();
                res.status(200).json(req.session.user);
            }
        } else if (hasName && hasPassword && !hasEmail) { // for login
            if (findUserByName !== null) {
                const matchPassword = await bcrypt.compare(pwd, findUserByName.password);
                if (matchPassword) {
                    req.session.user = findUserByName;
                    req.session.save();
                    res.status(200).json(req.session.user);
                } else {
                    res.status(400).json({ message: "Invalid password!" });
                }
            } else {
                res.status(400).json({ message: "Invalid Username!" });
            }
        }
    } catch (err) {
        console.log(err);
        res.status(400).json({ message: "Failed to Login" });
    }
};

router.post('/login', [
    body('USER_CREDENTIAL').optional().notEmpty().withMessage('USER_CREDENTIAL cannot be empty'),
    body('loginData.name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('loginData.email').optional().isEmail().withMessage('Invalid email format'),
    body('loginData.password').optional().notEmpty().withMessage('Password cannot be empty'),
    body('tokenResponse.access_token').optional().notEmpty().withMessage('Access token cannot be empty')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array() });
    }

    let rawUserData;
    let preciseUserData;

    try {
        const receivedData = Object.keys(req.body).toString();
        switch (receivedData) {
            case 'USER_CREDENTIAL': {
                const codedData = req.body.USER_CREDENTIAL;
                rawUserData = jwtDecode(codedData.credential);
                await handleUser(rawUserData, preciseUserData, collection, req, res);
                break;
            }
            case 'loginData': {
                rawUserData = req.body.loginData;
                await handleRawUser(rawUserData, preciseUserData, collection, req, res);
                break;
            }
            case 'tokenResponse': {
                const access_token = req.body.tokenResponse.access_token;
                const response = await axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${access_token}`);
                rawUserData = await response.data;
                await handleUser(rawUserData, preciseUserData, collection, req, res);
                break;
            }
            default:
                console.log("Unknown data received");
        }
    } catch (err) {
        res.status(400).json({ message: "Failed to login" });
    }
});

module.exports = router;
