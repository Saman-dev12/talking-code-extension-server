"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const drizzle_1 = require("../../db/drizzle");
const schema_1 = require("../../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const github_load_1 = require("../../lib/github-load");
const langchain_1 = require("../../lib/langchain");
const generative_ai_1 = require("@google/generative-ai");
const router = express_1.default.Router();
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const newProjectSchema = zod_1.z.object({
    github_url: zod_1.z.string().url(),
});
const querySchema = zod_1.z.object({
    query: zod_1.z.string().min(5),
    github_url: zod_1.z.string().url(),
});
router
    .post("/new", async (req, res) => {
    console.log("Request to /new");
    try {
        const parsed = newProjectSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Invalid GitHub URL" });
            return;
        }
        const { github_url } = parsed.data;
        const [existingProject] = await drizzle_1.db
            .select()
            .from(schema_1.extensionProjectsTable)
            .where((0, drizzle_orm_1.eq)(schema_1.extensionProjectsTable.githubUrl, github_url));
        if (existingProject) {
            res.status(200).json({
                message: "Extension project already exists",
                project: existingProject,
            });
            return;
        }
        const [newExtensionProject] = await drizzle_1.db
            .insert(schema_1.extensionProjectsTable)
            .values({
            githubUrl: github_url,
        })
            .returning();
        if (!newExtensionProject) {
            res.status(500).json({ error: "Failed to create extension project" });
            return;
        }
        try {
            await (0, github_load_1.extensionIndexGithubRepo)(newExtensionProject.id, github_url);
        }
        catch (error) {
            console.log(error);
            await drizzle_1.db
                .delete(schema_1.extensionProjectsTable)
                .where((0, drizzle_orm_1.eq)(schema_1.extensionProjectsTable.id, newExtensionProject.id));
            res.status(500).json({ error: "Failed to create extension project" });
            return;
        }
        res.status(200).json({
            message: "Extension project created successfully",
            project: newExtensionProject,
        });
    }
    catch (error) {
        console.error("Error creating project:", error);
        res.status(500).json({ error: "Failed to create extension project" });
    }
})
    .post("/query", async (req, res) => {
    console.log("Request to /query");
    try {
        const parsed = querySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Invalid input" });
            return;
        }
        const { query, github_url } = parsed.data;
        const [extensionProject] = await drizzle_1.db
            .select()
            .from(schema_1.extensionProjectsTable)
            .where((0, drizzle_orm_1.eq)(schema_1.extensionProjectsTable.githubUrl, github_url));
        if (!extensionProject) {
            res.status(400).json({ error: "Extension Project does not exist" });
            return;
        }
        const queryEmbeddings = await (0, github_load_1.generateEmbeddings)(query);
        const results = await drizzle_1.db
            .select({
            sourceCode: schema_1.extensionSourceCodeEmbeddingTable.sourceCode,
            fileName: schema_1.extensionSourceCodeEmbeddingTable.fileName,
            summary: schema_1.extensionSourceCodeEmbeddingTable.summary,
            similarity: (0, drizzle_orm_1.sql) `1 - (${(0, drizzle_orm_1.cosineDistance)(schema_1.extensionSourceCodeEmbeddingTable.summaryEmbeddings, queryEmbeddings)})`,
        })
            .from(schema_1.extensionSourceCodeEmbeddingTable)
            .where((0, drizzle_orm_1.eq)(schema_1.extensionSourceCodeEmbeddingTable.extensionProjectId, extensionProject.id))
            .orderBy((t) => (0, drizzle_orm_1.desc)(t.similarity))
            .limit(10);
        const updatedData = results.map((item) => ({
            ...item,
            fileName: item.fileName.replaceAll("\\", "/"),
            sourceCode: item.sourceCode.replaceAll("================================================", ""),
        }));
        const context = updatedData
            .map((doc) => `source: ${doc.fileName}\ncode content: ${doc.sourceCode}\nsummary: ${doc.summary}`)
            .join("\n\n");
        const output = await langchain_1.chain.invoke({ context, question: query });
        res.status(200).json({ output });
    }
    catch (error) {
        console.error("Error processing query:", error);
        res.status(500).json({ error: "Failed to process query" });
    }
})
    .post("/query-stream", async (req, res) => {
    console.log("Request to /query-stream");
    try {
        const parsed = querySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Invalid input" });
            return;
        }
        const { query, github_url } = parsed.data;
        const [extensionProject] = await drizzle_1.db
            .select()
            .from(schema_1.extensionProjectsTable)
            .where((0, drizzle_orm_1.eq)(schema_1.extensionProjectsTable.githubUrl, github_url));
        if (!extensionProject) {
            res.status(400).json({ error: "Extension Project does not exist" });
            return;
        }
        const queryEmbeddings = await (0, github_load_1.generateEmbeddings)(query);
        const results = await drizzle_1.db
            .select({
            sourceCode: schema_1.extensionSourceCodeEmbeddingTable.sourceCode,
            fileName: schema_1.extensionSourceCodeEmbeddingTable.fileName,
            summary: schema_1.extensionSourceCodeEmbeddingTable.summary,
            similarity: (0, drizzle_orm_1.sql) `1 - (${(0, drizzle_orm_1.cosineDistance)(schema_1.extensionSourceCodeEmbeddingTable.summaryEmbeddings, queryEmbeddings)})`,
        })
            .from(schema_1.extensionSourceCodeEmbeddingTable)
            .where((0, drizzle_orm_1.eq)(schema_1.extensionSourceCodeEmbeddingTable.extensionProjectId, extensionProject.id))
            .orderBy((t) => (0, drizzle_orm_1.desc)(t.similarity))
            .limit(10);
        const updatedData = results.map((item) => ({
            ...item,
            fileName: item.fileName.replaceAll("\\", "/"),
            sourceCode: item.sourceCode.replaceAll("================================================", ""),
        }));
        const context = updatedData
            .map((doc) => `source: ${doc.fileName}\ncode content: ${doc.sourceCode}\nsummary: ${doc.summary}`)
            .join("\n\n");
        const output = await langchain_1.chain.stream({ context, question: query });
        for await (const chunk of output) {
            res.write(chunk);
        }
        res.status(200).end();
    }
    catch (error) {
        console.error("Error processing query:", error);
        res.status(500).json({ error: "Failed to process query" });
    }
})
    .post("/query-with-translation", async (req, res) => {
    console.log("Request to /query-with-translation");
    try {
        const data = req.body;
        const github_url = data.github_url;
        const translateToEnglish = await genAI
            .getGenerativeModel({ model: "gemini-pro" })
            .generateContent(`Translate this to English: ${data.query}`);
        const englishText = translateToEnglish.response.text();
        const questionEmbedding = await (0, github_load_1.generateEmbeddings)(englishText || "");
        const [existingExtensionProject] = await drizzle_1.db
            .select()
            .from(schema_1.extensionProjectsTable)
            .where((0, drizzle_orm_1.eq)(schema_1.extensionProjectsTable.githubUrl, github_url));
        if (!existingExtensionProject) {
            res.status(400).json({ error: "Extension project doesn't exist" });
            return;
        }
        let context = "";
        const similarity = (0, drizzle_orm_1.sql) `1-(${(0, drizzle_orm_1.cosineDistance)(schema_1.extensionSourceCodeEmbeddingTable.summaryEmbeddings, questionEmbedding)})`;
        const results = await drizzle_1.db
            .select({
            fileName: schema_1.extensionSourceCodeEmbeddingTable.fileName,
            summary: schema_1.extensionSourceCodeEmbeddingTable.summary,
            sourceCode: schema_1.extensionSourceCodeEmbeddingTable.sourceCode,
            similarity: similarity,
        })
            .from(schema_1.extensionSourceCodeEmbeddingTable)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.extensionSourceCodeEmbeddingTable.extensionProjectId, existingExtensionProject.id), (0, drizzle_orm_1.gt)(similarity, 0.5)))
            .orderBy((t) => (0, drizzle_orm_1.desc)(t.similarity))
            .limit(10);
        for (const doc of results) {
            context += `source: ${doc.fileName}\n, code content: ${doc.sourceCode}\n, summary of file: ${doc.summary}\n `;
        }
        const chatResponse = await genAI
            .getGenerativeModel({ model: "gemini-pro" })
            .generateContent(`Based on this GitHub repo context:\n${context}\nAnswer: ${englishText}`);
        const aiEnglishResponse = chatResponse.response.text();
        const translateToUserLang = await genAI
            .getGenerativeModel({ model: "gemini-pro" })
            .generateContent(`Translate this back to the ${data.language} language: ${aiEnglishResponse}`);
        res.status(200).json({ content: translateToUserLang.response.text() });
    }
    catch (error) {
        console.error("Error processing request:", error);
        res
            .status(500)
            .json({ error: "An error occurred while processing your request." });
    }
});
exports.default = router;
