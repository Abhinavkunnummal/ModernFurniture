const nocache = require('nocache');
const express=require('express');
const mongoose=require('mongoose')
const User=require('./model/userModel')
mongoose.connect('mongodb://127.0.0.1:27017/Ecommerce');
require('dotenv').config();
const flash = require ('express-flash')



const app=express()
const path=require('path')
const session=require('express-session')

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const GoogleSignIn = require('./model/googleSignIn');
app.use(nocache())
app.use(flash())

app.use(session({
    secret:process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}))

app.use(passport.initialize());
app.use(passport.session());

   // Passport setup for Google authentication
   passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:7000/auth/google/callback"
},
    async function (accessToken, refreshToken, profile, cb) {
        try {
            // Search for the user in the database based on Google profile ID
            let user = await User.findOne({ email: profile.emails[0].value });
            if (!user) {
                // Create a new user if not found in the database
                user = new User({
                    password: profile.id,
                    name: profile.displayName,
                    email: profile.emails[0].value,
                    is_admin:0,
                    is_verified:1

                });
                await user.save();
               
             
            }

            
            return cb(null, user);
        } catch (error) {
            return cb(error);
        }
    }
));

// Serialize and deserialize user functions
passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (obj, done) {
    done(null, obj);
});

app.use(express.static('public'));

const userRoute = require('./routes/userRoute1');
app.use('/',userRoute)

const adminRoute=require('./routes/adminRoute');
app.use('/admin',adminRoute)




app.listen(7000,()=>{
    console.log('http://localhost:7000'); 
    console.log('http://localhost:7000/admin');  
}) 