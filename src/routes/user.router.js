import { Router } from "express";
import {
  changeCurrentPassword,
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);

router.route("/login").post(loginUser);
// secured route
router.route("/logout").post(verifyJWT, logoutUser);

router.route("/refresh-token").post(refreshAccessToken);

router.route("/change-current-password").post(verifyJWT, changeCurrentPassword);

///////////////////////////////////////////////////////////////
router.route("/get-current-user").get(verifyJWT, getCurrentUser);

router.route("/update-account-details").patch(verifyJWT, updateAccountDetails);

router
  .route("/update-user-avatar")
  .patch(upload.single("avatar"), verifyJWT, updateUserAvatar);

router
  .route("/update-user-cover-image")
  .patch(upload.single("avatar"), verifyJWT, updateUserCoverImage);

export default router;
