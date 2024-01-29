const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DATABASE_URI);
const db = client.db('assamemployment');
const collection = db.collection('users');
const axios = require('axios');
const jwtDecode=require('jwt-decode');
const bcrypt = require('bcrypt');
const handleUser=async (rawUserData,preciseUserData,collection,req,res)=>{
  //isLinked=await collection.findOne({ id: rawUserData.id });
 // console.log("confirm a/c",isLinked);
  preciseUserData={
    "name": rawUserData.name,
    "email": rawUserData.email,
    "picture": rawUserData.picture,
    "savedPosts":[],
    "likedPosts":[],
    "followers":[],
    "following":[],
    "linkname":"",
    "id": rawUserData.id
    // "id":collection.length>0? collection[collection.length - 1].id + 1 : 1
  };
  const email=rawUserData.email;
  let duplicateUser = await collection.findOne({email});console.log('findOne working good',duplicateUser)
  const linkname=email.split('@')[0];
  preciseUserData.linkname = linkname;
  if(linkname.includes('.')) preciseUserData.linkname=linkname.replace(/\./g, '');
  //console.log(duplicateUser);
if(duplicateUser){console.log("Duplicate user found");
 isLinked=duplicateUser.hasOwnProperty("id");   //to check if the user is linked with google account

 if(!isLinked){
  const mergedAccount={...duplicateUser,id:rawUserData.id, picture:rawUserData.picture,name:rawUserData.name};
  await collection.replaceOne({ _id: duplicateUser._id }, mergedAccount);
  req.session.user=mergedAccount;
  req.session.save();
  console.log("login session id:",req.session.id);
  console.log("login session:",req.session); 
  res.send(req.session.user);
}else{
  req.session.user=duplicateUser;
  req.session.save();
  console.log("login session id:",req.session.id);
  console.log("login session:",req.session); 
  res.send(req.session.user);
}
}
else{
 collection.insertOne(preciseUserData)
 console.log("new user is added");
 req.session.user=preciseUserData;
 req.session.save();
 console.log("login session id:",req.session.id);
 console.log("login session:",req.session); 
 res.send(req.session.user)
}
}
const handleRawUser= async (rawUserData,preciseUserData,collection,req,res)=>{
   try{
   const hasEmail=rawUserData.hasOwnProperty("email");
   const hasPassword=rawUserData.hasOwnProperty("password");
   const hasName=rawUserData.hasOwnProperty("name");
   const name=rawUserData.name;
   const email=rawUserData.email;
   const pwd=rawUserData.password;
   const findUserByName=await collection.findOne({name});
   const findUserByEmail=await collection.findOne({email});

  
   if(hasEmail&&hasPassword&&hasName){                        //for sign-up 
    
    const hashedPassword= await bcrypt.hash(pwd,10);
    preciseUserData={
      "name": rawUserData.name,
      "email": rawUserData.email,
      "password": hashedPassword,
      "savedPosts": [],
      "linkname":"",
      "likedPosts":[],
      "followers": [],
      "following":[]
      // "id":collection.length>0? collection[collection.length - 1].id + 1 : 1
    };
    const linkname=email.split('@')[0];
    preciseUserData.linkname = linkname;
    if(linkname.includes('.')) preciseUserData.linkname=linkname.replace(/\./g, '');
    if(findUserByName||findUserByEmail){
     const isLinked=findUserByEmail.hasOwnProperty("id");
     findUserByName? res.send("Sorry,the username you entered is already in use,please try a different username.")
     : findUserByEmail&&isLinked? res.send("You already have an account signed up with your google email,please login with your google account.")
     :res.send("This email address is already in use,please enter a different email address.");

    }else{
      collection.insertOne(preciseUserData)
      console.log("new user is added");
      req.session.user=preciseUserData;
      req.session.save();
      console.log("login session id:",req.session.id);
      console.log("login session:",req.session); 
      res.send(req.session.user);
    }
   }
   if(hasName&&hasPassword&&!hasEmail){
    if(findUserByName!==null){
      const matchPassword=await bcrypt.compare(pwd,findUserByName.password);
    
    if(matchPassword){
      req.session.user=findUserByName;
      req.session.save();
      console.log("login session id:",req.session.id);
      console.log("login session:",req.session); 
      res.send(req.session.user);
    }else{
      res.send("Invalid password!")
    }
    }else{
      res.send("Invalid Username!")
    }
    
   }
   }catch(err){console.log(err);res.send(err)}
}
router.post('/api/login',async (req, res) => {
  let rawUserData;
  let preciseUserData;
  try{
  // console.log(req.body);
   const  receivedData  = Object.keys(req.body).toString();
   switch(receivedData){
    case 'USER_CREDENTIAL': { 
                             const codedData=req.body.USER_CREDENTIAL
                             rawUserData =  jwtDecode(codedData.credential);
                             console.log(rawUserData);
                             handleUser(rawUserData,preciseUserData,collection,req,res); 
                             break;
                            }
    case 'loginData':       { 
                             rawUserData = req.body.loginData; 
                             handleRawUser(rawUserData,preciseUserData,collection,req,res)
                             break;
                            }
    case 'tokenResponse':   {
                            const access_token = req.body.tokenResponse.access_token;
                            const response=await axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${access_token}`)
                            rawUserData = await response.data;
                            handleUser(rawUserData,preciseUserData,collection,req,res);
                            console.log("user data from google:",rawUserData); 
                            break;
                            }
    default: console.log("Unknown data received");
   }
  
   
   //res.send("login data received");
  }catch(err){
    res.send(err)
  }
})


module.exports = router;
