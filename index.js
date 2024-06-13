const port = process.env.PORT || 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const { type } = require("os");
require('dotenv').config();  
const Database = process.env.DATABASE;
const BASE_URL = process.env.BASE_URL;

app.use(express.json());
app.use(cors());


//Database connnection with MongoDB
mongoose.connect(Database);

//API creation
app.get('/',(req,res)=>{
    res.send("Express app is Running ");
})

//Creating API for fetching Admin
const admin = {
    userId: "admin@123",
    password: "adminforshopper" // hashed version of 'adminforshopper'
};

// Creating API for fetching Admin
app.post('/fetchadmin', async (req, res) => {
    const { userId, password } = req.body;

    if (!userId || !password) {
        return res.status(400).json({ success: false, errors: "User Id and Password are required" });
    }
    if (admin.userId === userId) {
            const isPasswordValid = (password === admin.password);

            if (isPasswordValid) {
                const token = jwt.sign(admin,'secret_ecom');
                return res.json({ success: true, token });
            } else {
                return res.status(401).json({ success: false, errors: "Wrong Password" });
            }
        } else {
            return res.status(401).json({ success: false, errors: "Wrong User Id" });
        }
});


//Image storage Engine
const storage = multer.diskStorage({
    destination:'./upload/images',
    filename:(req,file,cb)=>{
        return cb(null,`${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
})

const upload = multer({storage:storage})

//Creating Upload Endpoint for images
app.use('/images',express.static('upload/images'))

app.post("/upload",upload.single('product'),(req,res)=>{
    res.json({
        success:1,
        image_url:`${BASE_URL}/images/${req.file.filename}`
    })
})

//API's for Login and signup
//Creating schema for user model
const Users = mongoose.model('Users',{
    name:{
        type:String
    },
    email:{
        type:String,
        unique:true
    },
    password:{
        type:String
    },
    cartData:{
        type:Object,
    },
    date:{
        type:Date,
        default:Date.now,
    }
})

//Creating endpoint for registering/signing up the user
app.post('/signup',async(req,res)=>{
    let check = await Users.findOne({email:req.body.email});
    if(check){
        return res.status(400).json({success:false,errors:"Exiting user found with same email address"})
    }
    let cart = {};
    for(let i=0;i<300;i++)
            cart[i] =0;
    const user = new Users({
        name:req.body.username,
        email:req.body.email,
        password:req.body.password,
        cartData:cart,
    })
    await user.save();
    const data = {
        user:{
            id:user.id
        }
    }
    const token = jwt.sign(data,'secret_ecom');
    res.json({success:true,token,name:user.name})
})

//Creating endpoint for logining-in the user
app.post('/login',async(req,res)=>{
    let user = await Users.findOne({email:req.body.email});
    if(user){
        const passCompare = req.body.password === user.password;
        if(passCompare){
            const data = {
                user:{
                    id:user.id
                }
            }
            const token = jwt.sign(data,'secret_ecom');
            res.json({success:true,token,name:user.name});
        }
        else{
            res.json({success:false,errors:"Wrong Password"});
        }
    }
    else{
        res.json({success:false,errors:"Wrong Email Id"});
    }
})

//Creating API for fetching all users
app.get('/allusers',async(req,res)=>{
    let AllUsers = await Users.find({});
    console.log('All users are fetched');
    res.send(AllUsers);
})

//Creating API for removing user
app.post('/remouser',async(req,res)=>{
    await Users.findOneAndDelete({email:req.body.email});
    console.log("Deleted user");
    res.json({
        success:true,
        name:req.body.username
    })
})

//Creating middelware to fetch user
const fetchUser = async(req,res,next)=>{
    const token = req.header('auth-token');
    if (!token) {
        return res.status(401).send({ errors: "Please authenticate using a valid token" });
    }
    try {
        const data = jwt.verify(token, 'secret_ecom');
        req.user = data.user;
        next();
    } catch (error) {
        res.status(401).send({ errors: "Please authenticate using a valid token" });
    }
}

//Creating Endpoint or API for adding products in cartdata
app.post('/addtocart',fetchUser,async(req,res)=>{
    let userData = await Users.findOne({_id:req.user.id});
    userData.cartData[req.body.itemId] += 1;
    await Users.findByIdAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("Item added");
})

//Creating Endpoint or API for removi2ng the product from cartdata
app.post('/removefromcart',fetchUser,async(req,res)=>{
    let userData = await Users.findOne({_id:req.user.id});
    if(userData.cartData[req.body.itemId]>0)
    userData.cartData[req.body.itemId] -= 1;
    await Users.findByIdAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("Item removed");
})

//Creating Endpoint or API to get cartData
app.post('/getcart',fetchUser,async(req,res)=>{
    console.log("User's cartData is fetched");
    let userData = await Users.findOne({_id:req.user.id});
    res.json(userData.cartData);
})

//schema for creating model for product
const Product = mongoose.model("Product",{
    id:{
        type:Number,
        require:true
    },
    name:{
        type:String,
        require:true
    },
    image:{
        type:String,
        require:true,
    },
    category:{
        type:String,
        require:true
    },
    new_price:{
        type:Number,
        require:true
    },
    old_price:{
        type:Number,
        require:true
    },
    date:{
        type:Date,
        default:Date.now
    },
    available:{
        type:Boolean,
        default:true,
    }
})

//Creating endpoint/API for adding product
app.post('/addproduct',async(req,res)=>{
    let products = await Product.find({});
    let id;
    if(products.length>0){
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id + 1;
    }
    else{
        id=1;
    }
    const product = new Product({
        id:id,
        name:req.body.name,
        image:req.body.image,
        category:req.body.category,
        new_price:req.body.new_price,
        old_price:req.body.old_price
    })

    console.log(product);
    await product.save();
    console.log("Saved");
    res.json({
        success:true,
        name:req.body.name,
    })
})

//Creating API for deleting products
app.post('/deleteproduct',async(req,res)=>{
    await Product.findOneAndDelete({id:req.body.id});
    console.log("Removed");
    res.json({
        success:true,
        name:req.body.name
    })
})

//creating API for fetching all products
app.get('/allproducts',async(req,res)=>{
    let products = await Product.find({});
    console.log("ALL products are fetched");
    res.send(products);
})

//Creating API for fetching new collections
app.get('/newcollection',async(req,res)=>{
    let products = await Product.find({});
    let newcollection = products.slice(-8);
    console.log("New collections fetched ");
    res.send(newcollection);
})

//creating API for fetching popular in women
app.get('/popularinwomen',async(req,res)=>{
    let products = await Product.find({category:"women"})
    let popularProducts = products.slice(-4);
    console.log("Popular in women is fetched");
    res.send(popularProducts);
})

app.listen(port, (error) => {
    if(!error)
    console.log(`Server running on port ${port}`);
    else
    console.log("Error : " + error);
});