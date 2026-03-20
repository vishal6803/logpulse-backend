"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginUserService = exports.registerUserService = void 0;
const db_1 = __importDefault(require("../../config/db"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const registerUserService = async (data) => {
    const { email, password, name } = data;
    // first check for email if already exists in the database
    const existingUser = await isUserExists(email);
    if (existingUser) {
        throw new Error("Email already exists");
    }
    // if not exists, insert the user into the database
    // create pass hash
    const salt = await bcryptjs_1.default.genSalt(10);
    const hasPassword = await bcryptjs_1.default.hash(password, salt);
    const result = await db_1.default.query("INSERT INTO users (id ,email , password_hash , name) VALUES (gen_random_uuid(), $1 , $2 , $3) RETURNING id , email , name", [email, hasPassword, name]);
    return result.rows[0];
};
exports.registerUserService = registerUserService;
const loginUserService = async (email, password) => {
    // check if user exists
    const existinguser = await isUserExists(email);
    if (!existinguser) {
        throw new Error("Invalid email or password");
    }
    const match = await bcryptjs_1.default.compare(password, existinguser.password_hash);
    if (!match) {
        throw new Error("Invalid email or password");
    }
    // prepare user jwt token
    const payload = {
        id: existinguser.id,
        email: existinguser.email,
        name: existinguser.name,
    };
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("FATAL ERROR: JWT_SECRET is not defined in the .env file!");
    }
    const token = jsonwebtoken_1.default.sign(payload, secret, { expiresIn: "7h" });
    return `Bearer ${token}`;
};
exports.loginUserService = loginUserService;
const isUserExists = async (email) => {
    const result = await db_1.default.query("SELECT * FROM users WHERE email = $1", [
        email,
    ]);
    return result.rows[0] || null;
};
