import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloundinary } from "../utils/cloudinary.js";
import validateEmail from "../utils/validateEmail.js";
import { ApiResponse } from "../utils/apiResponse.js";

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
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(409, "Avatar file is required.");
  }

  const avatar = await uploadOnCloundinary(avatarLocalPath);
  const coverImage = await uploadOnCloundinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(409, "Avatar file is required.");
  }

  // new User({});
  // User.save();
  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage ? coverImage?.url : "",
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

export { registerUser };
