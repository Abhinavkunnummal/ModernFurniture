const nocache = require('nocache');
const express=require('express');
const mongoose=require('mongoose')
const User=require('./model/userModel')
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, {
}).then(() => {
    console.log('Successfully connected to MongoDB');
}).catch((error) => {
    console.error('Error connecting to MongoDB', error);
});


const flash = require ('express-flash')


const app=express()
const path=require('path')
const session=require('express-session')

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const GoogleSignIn = require('./model/googleSignIn');


app.use(session({
    secret:process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}))

app.use(passport.initialize());
app.use(passport.session());

app.use(nocache())
app.use(flash())

   passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://abhinavkunnummal.online/auth/google/callback"
},
    async function (accessToken, refreshToken, profile, cb) {
        try {
            let user = await User.findOne({ email: profile.emails[0].value });
            if (!user) {
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