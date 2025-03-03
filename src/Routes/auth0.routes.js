import express from "express";
import passport from "../Config/auth0.js"

const router = express.Router();

// 🔹 Auth0 Login Route
router.get("/auth/auth0", passport.authenticate("auth0", { scope: "openid email profile" }));

// 🔹 Auth0 Callback Route
router.get("/auth/callback", passport.authenticate("auth0", { failureRedirect: "/" }), (req, res) => {
  res.redirect("/dashboard");
});

// 🔹 Logout Route
router.get("/logout", (req, res) => {
  req.logout();
  res.redirect(process.env.AUTH0_LOGOUT_URL);
});

export default router;
