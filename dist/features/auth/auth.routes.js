"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("./auth.controller");
const routes = express_1.default.Router();
routes.post("/login", auth_controller_1.loginUser);
routes.post("/register", auth_controller_1.registerUser);
exports.default = routes;
