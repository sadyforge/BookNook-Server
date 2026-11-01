import express from 'express'
import 'dotenv/config' 
import cors from "cors"
import { MongoClient, ObjectId } from 'mongodb';
import { createRemoteJWKSet, jwtVerify } from 'jose'





const port=process.env.PORT || 3002
const app=express()


app.use(cors())
app.use(express.json())


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
const borrowsCollection = db.collection("borrows");

//middleware
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }
  const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
  );
  try {
    const { payload } = await jwtVerify(token, JWKS);
    next();
  } catch (error) {
    return res.status(401).send({ msg: "Token Doesnot verify" });
  }
};


// Add Books
app.post("/add-books",verifyToken, async (req, res) => {
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
app.get("/all-books/:email",verifyToken, async (req, res) => {
  const { email } = req.params;

  const result = await booksCollection
    .find({ userEmail: email })
    .toArray();

  res.send(result);
});


// Get Single Book
app.get("/books/:id",verifyToken, async (req, res) => {
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
app.patch("/books/:id",verifyToken,async(req,res)=>{
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

//delete books
app.delete("/books/:id",verifyToken,async(req,res)=>{
   const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ msg: "Invalid destination ID" });
    }
      const result = await booksCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.send(result)

})


// borrows post 
// app.post("/borrow",async(req,res)=>{
//   const data=req.body
//   const result=await borrowsCollection.insertOne(data)
//   res.send(result)
// })

app.post("/borrow",verifyToken, async (req, res) => {
  try {
    const data = req.body;

    // Check if the user currently has this book
    const existingBorrow = await borrowsCollection.findOne({
      bookId: data.bookId,
      userEmail: data.userEmail,
      status: { $ne: "returned" },
    });

    if (existingBorrow) {
      return res.status(409).send({
        message: "You have already borrowed this book!",
      });
    }

    // Check book availability
    const book = await booksCollection.findOne({
      _id: new ObjectId(data.bookId),
      availableCopies: { $gt: 0 },
    });

    if (!book) {
      return res.status(400).send({
        message: "This book is currently unavailable!",
      });
    }

    // Decrease available copies
    const updateBook = await booksCollection.updateOne(
      {
        _id: new ObjectId(data.bookId),
        availableCopies: { $gt: 0 },
      },
      {
        $inc: { availableCopies: -1 },
      }
    );

    if (updateBook.modifiedCount === 0) {
      return res.status(400).send({
        message: "This book is currently unavailable!",
      });
    }

    data.status = "borrowed";

    const result = await borrowsCollection.insertOne(data);

    res.status(201).send({
      success: true,
      message: "Book borrowed successfully!",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Borrow error:", error);

    res.status(500).send({
      message: "Something went wrong!",
    });
  }
});


// app.post("/borrow", async (req, res) => {
//   const data = req.body;

//   try {
//     // Check if user already borrowed this book
//     const alreadyBorrowed = await borrowsCollection.findOne({
//       bookId: data.bookId,
//       userEmail: data.userEmail,
//       status: { $ne: "returned" },
//     });

//     if (alreadyBorrowed) {
//       return res.status(400).send({
//         message: "You have already borrowed this book!",
//       });
//     }

//     // Check book availability
//     const book = await booksCollection.findOne({
//       _id: new ObjectId(data.bookId),
//       availableCopies: { $gt: 0 },
//     });

//     if (!book) {
//       return res.status(400).send({
//         message: "This book is currently unavailable!",
//       });
//     }

//     // Decrease available copies
//     await booksCollection.updateOne(
//       {
//         _id: new ObjectId(data.bookId),
//         availableCopies: { $gt: 0 },
//       },
//       {
//         $inc: { availableCopies: -1 },
//       }
//     );

//     // Insert borrow information
//     data.status = "borrowed";
//     const result = await borrowsCollection.insertOne(data);

//     res.send(result);
//   } catch (error) {
//     res.status(500).send({
//       message: "Something went wrong!",
//     });
//   }
// });


//borrows get
app.get("/borrow",verifyToken,async(req,res)=>{
  const result=await borrowsCollection.find().toArray()
  res.send(result)
})

//single borrow
app.patch("/borrow/:id",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { bookId } = req.body;

    if (!ObjectId.isValid(id) || !ObjectId.isValid(bookId)) {
      return res.status(400).send({
        message: "Invalid ID",
      });
    }

    const borrow = await borrowsCollection.findOne({
      _id: new ObjectId(id),
      status: "borrowed",
    });

    if (!borrow) {
      return res.status(404).send({
        message: "Borrow record not found or already returned",
      });
    }

    if (borrow.bookId !== bookId) {
      return res.status(400).send({
        message: "Book information does not match",
      });
    }

    const result = await borrowsCollection.updateOne(
      {
        _id: new ObjectId(id),
        status: "borrowed",
      },
      {
        $set: {
          status: "returned",
          actualReturnDate: new Date().toISOString().split("T")[0],
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).send({
        message: "Book already returned",
      });
    }

    await booksCollection.updateOne(
      {
        _id: new ObjectId(bookId),
      },
      {
        $inc: {
          availableCopies: 1,
        },
      }
    );

    res.send({
      success: true,
      message: "Book returned successfully",
    });
  } catch (error) {
    console.error("Return book error:", error);

    res.status(500).send({
      message: "Failed to return book",
    });
  }
});

app.get("/",(req,res)=>{
    res.send("Hello world")
})


app.listen(port ,()=>{
    console.log(`app listening on ${port}`)
})