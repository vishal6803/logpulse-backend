"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_routes_1 = __importDefault(require("./features/auth/auth.routes"));
const projects_routes_1 = __importDefault(require("./features/projects/projects.routes"));
const auth_middleware_1 = require("./middlewares/auth.middleware");
const app = (0, express_1.default)();
require("dotenv").config();
app.use(express_1.default.json());
const PORT = process.env.PORT || 3000;
app.get("/", auth_middleware_1.authMiddleware, (req, res) => {
    // will chnage when projects craeted api will be created
    res.send("Hello World!");
});
app.use("/api/auth", auth_routes_1.default);
app.use("/api/projects", auth_middleware_1.authMiddleware, projects_routes_1.default);
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
