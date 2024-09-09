import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" })); // -> Allow to accept json
app.use(express.urlencoded({ exptended: true, limit: "16kb" })); // -> encode URL (useful when dealing with URL)
app.use(express.static("public"));
app.use(cookieParser()); // -> Now you can Access cookies from server and perform CRUD operation on them

import userRouter from "./routes/user.router.js";
app.use("/api/v1/users", userRouter);

export { app };
