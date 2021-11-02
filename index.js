const express = require('express');
const { MongoClient } = require('mongodb');
var admin = require("firebase-admin");

require('dotenv').config();

const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

//firebase admin initialization
var serviceAccount = require('./react-simple-e-commerce-6a43e-firebase-adminsdk-57xyf-22b9adb160.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.seewk.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//function to get id token from client side
async function verifyToken(req, res, next) {
    //checking if there is authorization token
    if(req.headers?.authorization?.startsWith('Bearer ')) {
        const idToken = req.headers.authorization.split('Bearer ')[1]; //spliting authorization and taking only token part

        //verifying token
        try {
            const decodedUser = await admin.auth().verifyIdToken(idToken);
            //console.log('email:', decodedUser.email);
            req.decodedUserEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}

async function run () {
    try {
        await client.connect();
        const database = client.db("E-commerce"); //it will create a doc in db
        const productCollection = database.collection("products");

        //collection for orders
        const orderCollection = database.collection('orders');

        //GET products api
        app.get('/products', async(req, res)=>{
            //console.log(req.query);

            const cursor = productCollection.find({});

            //taking page related info
            const page = req.query.page;
            const size = parseInt(req.query.size);
            let products;
            //----------for pagination----------
            const count = await cursor.count();
            if(page) {
                products = await cursor.skip(page * size).limit(size).toArray();
            } else {
                products = await cursor.toArray();
            }
            
            res.send({
                count,
                products});
        });
        
        //POST req to get data by keys
        app.post('/products/byKeys', async(req,res)=>{
            const keys = req.body;
            const query = {key: {$in: keys}};
            const products = await productCollection.find(query).toArray();
            res.json(products);
        });

        //get orders API
        app.get('/orders', verifyToken, async (req, res) => {
            //console.log(req.headers.authorization);
            const email = req.query.email; //taking user email from query parameter
            
            //checking if email from url and email from firebase after authorization are same
            if(req.decodedUserEmail === email) {
                const query = {email: email};
                const cursor = orderCollection.find(query);
                const orders = await cursor.toArray();
                res.json(orders);
            } else {
                res.status(401).json({message: 'Unauthorized user'})
            }          
        })

        //add orders api
        app.post('/orders', async(req, res) => {
            const order = req.body;
            order.createdAt = new Date();
            const result = await orderCollection.insertOne(order);
            res.json(result);
        })
    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res)=>{
    res.send('E-Commerce server is running');
});

app.listen(port, ()=>{
    console.log('Server running at port ', port);
})