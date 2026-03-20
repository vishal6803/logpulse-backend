import { RegisterDTO } from "./auth.schema";
import pool from "../../config/db";
import bcrypt from "bcryptjs";
import jwt, { PrivateKey } from "jsonwebtoken";
export const registerUserService = async (data: RegisterDTO) => {
  const { email, password, name } = data;

  // first check for email if already exists in the database
  const existingUser = await isUserExists(email);
  if (existingUser) {
    throw new Error("Email already exists");
  }

  // if not exists, insert the user into the database

  // create pass hash

  const salt = await bcrypt.genSalt(10);
  const hasPassword = await bcrypt.hash(password, salt);
  const result = await pool.query(
    "INSERT INTO users (id ,email , password_hash , name) VALUES (gen_random_uuid(), $1 , $2 , $3) RETURNING id , email , name",
    [email, hasPassword, name],
  );
  return result.rows[0];
};

export const loginUserService = async (email: string, password: string) => {
  // check if user exists
  const existinguser = await isUserExists(email);
  if (!existinguser) {
    throw new Error("Invalid email or password");
  }
  const match = await bcrypt.compare(password, existinguser.password_hash);
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
  const token = jwt.sign(payload, secret, { expiresIn: "7h" });
  return `Bearer ${token}`;
};

const isUserExists = async (email: string): Promise<any | null> => {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0] || null;
};
