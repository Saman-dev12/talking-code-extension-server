"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const github_load_1 = require("../../lib/github-load");
const drizzle_1 = require("../../db/drizzle");
const schema_1 = require("../../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const langchain_1 = require("../../lib/langchain");
const router = express_1.default.Router();
const queryAnswerSchema = zod_1.z.object({
    query: zod_1.z
        .string()
        .min(5, "Atleast 5 characters are required to start the query"),
    projectId: zod_1.z.string().uuid("Invalid Project Id"),
    last3Messages: zod_1.z.array(zod_1.z.object({
        query: zod_1.z.string(),
        ai_response: zod_1.z.string(),
    })),
});
router.post("/query-stream", async (req, res) => {
    console.log("Request to /query-stream");
    try {
        const parsed = queryAnswerSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Invalid input" });
            return;
        }
        const { query, projectId, last3Messages } = parsed.data;
        const queryEmbeddings = await (0, github_load_1.generateEmbeddings)(query);
        const results = await drizzle_1.db
            .select({
            sourceCode: schema_1.sourceCodeEmbeddingTable.sourceCode,
            fileName: schema_1.sourceCodeEmbeddingTable.fileName,
            summary: schema_1.sourceCodeEmbeddingTable.summary,
            similarity: (0, drizzle_orm_1.sql) `1 - (${(0, drizzle_orm_1.cosineDistance)(schema_1.sourceCodeEmbeddingTable.summaryEmbedding, queryEmbeddings)})`,
        })
            .from(schema_1.sourceCodeEmbeddingTable)
            .where((0, drizzle_orm_1.eq)(schema_1.sourceCodeEmbeddingTable.projectId, projectId))
            .orderBy((t) => (0, drizzle_orm_1.desc)(t.similarity))
            .limit(10);
        // console.log(results);
        const updatedData = results.map((item) => ({
            ...item,
            fileName: item.fileName.replaceAll("\\", "/"),
            sourceCode: item.sourceCode.replaceAll("================================================", ""),
        }));
        // console.log(updatedData);
        let context = "";
        for (const doc of updatedData) {
            context += `source: ${doc.fileName}\n, code content: ${doc.sourceCode}\n, summary of file: ${doc.summary}\n `;
        }
        // console.log(context);
        const output = await langchain_1.chainWithHistory.stream({
            context,
            question: query,
            conversation_history: last3Messages,
        });
        for await (const chunk of output) {
            res.write(chunk);
        }
        res.status(200).end();
    }
    catch (error) {
        console.error("Error processing query:", error);
        res.status(500).json({ error: "Failed to process query" });
    }
});
exports.default = router;
