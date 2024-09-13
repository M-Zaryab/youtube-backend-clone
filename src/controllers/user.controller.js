import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloundinary } from "../utils/cloudinary.js";
import validateEmail from "../utils/validateEmail.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while creating access token and refresh token. "
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // Get user details from frontend
  // Validation - not empty
  // check if user already exist
  // check for avtar and coverImage
  // Upload files on cloudinary
  // create user object - Store data in database
  // remove password and refresh token from the user field
  // check for user creation
  // return response

  const { fullname, username, email, password } = req.body;

  if (
    [fullname, username, email, password].some((field) => {
      field?.trim() === "";
    })
  ) {
    throw new ApiError(400, "All fields are required.");
  }

  const isUserPresent = await User.findOne({ $or: [{ email }, { username }] });
  if (isUserPresent) {
    throw new ApiError(409, "User with username or email already exists.");
  }

  // validateEmail(email);

  const avatarLocalPath = req.files?.avatar[0]?.path;

  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  let coverImageLocalPath;
  // if (req.files && Array.isArray(req.files) && req.files.length > 0)
  if (req.files) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(409, "Avatar file is required.");
  }

  const avatar = await uploadOnCloundinary(avatarLocalPath);
  const coverImage = await uploadOnCloundinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(409, "Avatar file is required.");
  }

  console.log("coverImage ", coverImage);

  // new User({});
  // User.save();
  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.trim().toLocaleLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while creating the user.");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User created successfully."));

  //////////////////////////////////////////
  // if (!fullName || !username || !email || !password || !avatar) {
  //   throw new ApiError(400, "All fields are required.");
  // }

  // const isPresent = await user.findOne({ email });
  // if (isPresent) {
  //   throw new APIError(400, "User already exists.");
  // }

  // console.log(req.files);

  // const avatarPath = req.files?.avatar;
  // const coverImagePath = req.files?.coverImage;

  // uploadOnCloundinary(avatarPath);
  // uploadOnCloundinary(coverImagePath);

  // const createdUser = await User.create({
  //   fullName,
  //   username,
  //   password,
  //   email,
  //   avatar,
  //   coverImage,
  // });

  // if (!createdUser) throw new APIError(400, "User not created.");

  // await createdUser.select("-passeord -refreshToken");

  // return createdUser;
});

const loginUser = asyncHandler(async (req, res) => {
  // get Data from User
  // Find user from that email
  // Check password
  // generate Access and Refresh Token
  // send cookies

  const { username, email, password } = req.body;

  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required");
  }

  const user = await User.findOne({ $or: [{ email }, { username }] });

  if (!user) {
    throw new ApiError(404, "User does not exist.");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Incorrect Password.");
  }

  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    // Now can only be modified by server
    httpOnly: true, // By default cookies can be modified in frontend
    secure: true, // These properties will secure your cookies from being leaked
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully."
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // We have to remove the value of Refresh Token from the model
  // Now how to access user? We will decode info from JWT Token in middleware

  // 1. remove cookies
  // 2. remove refresh token
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully."));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  // Take refresh token from cookies
  // match it with the one in database
  // if same then generate new JWT Tokens

  try {
    const incommingRefreshToken =
      req.cookies?.refreshToken || req.body.refreshToken;

    const decodedToken = await jwt.verify(
      incommingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (user?.refreshToken !== incommingRefreshToken) {
      throw new ApiError(401, "Refresh token expired or used.");
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Tokens Refreshed successflly."
        )
      );
  } catch (error) {
    throw new ApiError(500, "Failed to refresh access token");
  }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };
