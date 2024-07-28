const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb'); 
const mongoose = require('mongoose');
const { query, validationResult } = require('express-validator');

const client = new MongoClient(process.env.DATABASE_URI);
const db = client.db('assamemployment');
const posts = db.collection('posts');
const profiles = db.collection('users');

router.get('/search', [
    // Validate and sanitize input
    query('searchTerm').isString().trim().notEmpty().withMessage('Search term is required'),
    query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer')
], async (req, res) => {
    // Handle validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array() });
    }

    try {
        const { searchTerm } = req.query;
        const perPage = 5;
        const page = parseInt(req.query.page) || 1; // Get the page from query parameter, default to 1 if not provided
        const skip = (page - 1) * perPage; // Calculate the number of documents to skip
        // Constructing the regex pattern to search for the searchTerm
        const regexPattern = new RegExp(searchTerm, 'i'); //'i' for case insensitive

        // Using $regex to search for documents where any field matches the searchTerm
        const postResults = await posts.find({
            $or: [
                { title: { $regex: regexPattern } },
                { organization: { $regex: regexPattern } },
            ]
        }).toArray();

        const profileResults = await profiles.find({
            $or:[
                { name: { $regex: regexPattern } }
            ]
        }).toArray();

        // Combine and paginate all results
        const allResults = [
            ...postResults.map(post => ({ title: post.title, link: `/post/${post._id}` })),
            ...profileResults.map(profile => ({ title: profile.name, link: `/profile/${profile.linkname}` }))
        ];

        const paginatedResults = allResults.slice(skip, skip + perPage);

        res.status(200).json(paginatedResults);
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.get('/fullSearch', [
    // Validate and sanitize input
    query('searchTerm').isString().trim().notEmpty().withMessage('Search term is required'),
    query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer')
], async (req, res) => {
    // Handle validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { searchTerm } = req.query;
        const perPage = 5;
        const page = parseInt(req.query.page) || 1; // Get the page from query parameter, default to 1 if not provided
        const skip = (page - 1) * perPage; // Calculate the number of documents to skip
        // Constructing the regex pattern to search for the searchTerm
        const regexPattern = new RegExp(searchTerm, 'i'); //'i' for case insensitive

        // Using $regex to search for documents where any field matches the searchTerm
        const postResults = await posts.find({
            $or: [
                { title: { $regex: regexPattern } },
                { organization: { $regex: regexPattern } },
            ]
        }).skip(skip)
        .limit(perPage)
        .toArray();
        
        const totalPosts = await posts.find({
            $or: [
                { title: { $regex: regexPattern } },
                { organization: { $regex: regexPattern } },
            ]
        }).toArray();

        console.log(totalPosts.length);

        res.status(200).json(postResults);
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Internal server error" });
    }
});

module.exports = router;
