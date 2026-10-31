import express from 'express'
import 'dotenv/config' 
import cors from "cors"
const port=process.env.PORT || 3002
const app=express()


app.use(cors())
app.use(express.json())

import { MongoClient, ObjectId } from 'mongodb';

const client = new MongoClient(process.env.MONGO_URL);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
connectToMongoDB()
const mongoClient = await connectToMongoDB();
const db = mongoClient.db("booknook");
const booksCollection = db.collection("books");
const defaultBooksCollection = db.collection("defaultBooks");


// Add Books
app.post("/add-books", async (req, res) => {
  const data = req.body;
  const result = await booksCollection.insertOne(data);
  res.send(result);
});


// Default Books
app.get("/default", async (req, res) => {
  const result = await defaultBooksCollection.find().toArray();
  res.send(result);
});


// Get User's Books
app.get("/all-books/:email", async (req, res) => {
  const { email } = req.params;

  const result = await booksCollection
    .find({ userEmail: email })
    .toArray();

  res.send(result);
});


// Get Single Book
app.get("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid book ID",
      });
    }

    let result = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!result) {
      result = await defaultBooksCollection.findOne({
        _id: new ObjectId(id),
      });
    }

    if (!result) {
      return res.status(404).send({
        message: "Book not found",
      });
    }

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch book",
    });
  }
});

// edit book
app.patch("/books/:id",async(req,res)=>{
  const {id}=req.params
  const updatedData=req.body
      if (!ObjectId.isValid(id)) {
      return res.status(400).send({ msg: "Invalid destination ID" });
    }
    
    const result = await booksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData },
    );

    res.send(result);
})


app.get("/",(req,res)=>{
    res.send("Hello world")
})


app.listen(port ,()=>{
    console.log(`app listening on ${port}`)
})