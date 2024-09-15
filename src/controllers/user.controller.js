import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloundinary } from "../utils/cloudinary.js";
import validateEmail from "../utils/validateEmail.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import fs from "fs";
import mongoose from "mongoose";

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

//////////////////////////////////////////////////////////////

const changeCurrentPassword = asyncHandler(async (req, res) => {
  // --- Algorithm ---
  // check if the current password is equal to user old password?
  // if so then update the password
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    throw new ApiError(400, "New Password and Confirm password are not same.");
  }

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Incorrect current password.");
  }

  user.password = newPassword;
  user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, "Your password is changed successfully."));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully."));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  try {
    const { fullname, email } = req.body;

    if (!fullname || !email) {
      throw new ApiError(400, "All fields are required.");
    }

    const user = await User.findByIdAndUpdate(
      req.user?._id,
      { $set: { fullname, email } },
      { new: true }
    ).select("-password");

    console.log(user);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          user,
          "fullname and email is updated successfully."
        )
      );
  } catch (error) {
    throw new ApiError(500, "Failed to update account details.");
  }
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  // upload file using multer
  // upload file on cloudinary

  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) throw new ApiError(400, "Avatar file is missing.");
  const avatar = await uploadOnCloundinary(avatarLocalPath);
  if (!avatar) throw new ApiError(400, "Error while uploading avatar.");

  // fs.unlinkSync(avatarLocalPath);
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { avatar: avatar.url } },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar successfully updated."));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  // upload file using multer
  // upload file on cloudinary

  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath)
    throw new ApiError(400, "Cover Image file is missing.");
  const coverImage = await uploadOnCloundinary(coverImageLocalPath);
  if (!coverImage)
    throw new ApiError(400, "Error while uploading cover image. ");

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { coverImage: coverImage.url } },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar successfully updated."));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "username is missing in params.");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username.toLocaleLowerCase(), // This is fine if username is a string
      },
    },
    {
      $lookup: {
        from: "subscriptions", // Ensure 'subscriptions' is the correct name of the collection
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions", // Ensure 'subscriptions' is the correct name of the collection
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscriberCount: { $size: "$subscribers" },
        channelsSubscribedToCount: { $size: "$subscribedTo" },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] }, // Fixed typo
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullname: 1,
        username: 1,
        subscriberCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "channel does not exist. ");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully. ")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(String(req.user._id)) }, // https://youtu.be/qNnR7cuVliI?list=PLu71SKxNbfoBGh_8p_NS-ZAh6v7HhYqHW&t=433
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            pipeline: [
              {
                $addFields: {
                  owner: {
                    $first: "$owner",
                  },
                },
              },
            ],
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch History fetched successfully. "
      )
    );
});
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
