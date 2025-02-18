"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const extension_1 = __importDefault(require("./routes/extension"));
const project_1 = __importDefault(require("./routes/project"));
const cors_1 = __importDefault(require("cors"));
const PORT = process.env.PORT || 4000;
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: ["*", "http://localhost:5173", "http://localhost:3000"],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.get("/", (req, res) => {
    res.send("Hello World!");
});
app.use("/api/extension", extension_1.default);
app.use("/api/project", project_1.default);
app.use((err, req, res, next) => {
    console.error("Internal Server Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
});
app.listen(PORT, () => {
    console.log(`Server started at port ${PORT}`);
});
