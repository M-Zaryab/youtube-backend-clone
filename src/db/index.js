import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import express from "express";
const app = express();

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );
    app.on("error", (err) => {
      console.log("ERROR: ", err);
      throw err;
    });
    console.log(
      `MONGODB_CONNECTED !! DB_HOST: `,
      connectionInstance.connection.host
    );
  } catch (err) {
    console.log("Mongodb connection error: ", err);
    process.exit(1);
  }
};

export default connectDB;
