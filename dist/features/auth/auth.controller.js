"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginUser = exports.registerUser = void 0;
const auth_service_1 = require("./auth.service");
const registerUser = async (req, res) => {
    if (!req.body.email || !req.body.password || !req.body.name) {
        return res
            .status(400)
            .json({ message: "Email, password and name are required" });
    }
    // register a user
    try {
        const newUser = await (0, auth_service_1.registerUserService)(req.body);
        res
            .status(201)
            .json({ message: "User registered successfully", user: newUser });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        if (errorMessage === "Email already exists") {
            return res.status(409).json({ message: errorMessage });
        }
        res.status(500).json({ message: errorMessage });
    }
};
exports.registerUser = registerUser;
const loginUser = async (req, res) => {
    if (!req.body.email || !req.body.password) {
        return res.status(400).json({ message: "Email and password are required" });
    }
    try {
        const token = await (0, auth_service_1.loginUserService)(req.body.email, req.body.password);
        res.status(200).json({ message: "Login successful", token });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        if (errorMessage === "Invalid email or password") {
            res.status(401).json({ message: errorMessage });
        }
        else {
            res.status(500).json({ message: errorMessage });
        }
    }
};
exports.loginUser = loginUser;
