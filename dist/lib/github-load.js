"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmbeddings = exports.generateSummary = exports.generateAllEmbeddings = exports.extensionIndexGithubRepo = exports.indexGithubRepo = void 0;
require("dotenv/config");
const drizzle_1 = require("../db/drizzle");
const generative_ai_1 = require("@google/generative-ai");
// import { Document } from "@langchain/core/documents";
const schema_1 = require("../db/schema");
const prompts_1 = require("@langchain/core/prompts");
// import { loadGithubRepo } from "./load-github";
// import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
const axios_1 = __importDefault(require("axios"));
const google_genai_1 = require("@langchain/google-genai");
const summaryPrompt = prompts_1.ChatPromptTemplate.fromMessages([
    [
        "system",
        `You are an intelligent senior software engineer specializing in onboarding junior software engineers onto a project.
    Your task is to summarize the purpose of a given code file to help a junior developer understand it.
    - Keep the summary concise (max 100 words).
    - Focus on the main functionality and purpose of the code.
    - Do not explain specific syntax unless necessary.
    - Provide a structured response without unnecessary explanations.
    `,
    ],
    [
        "human",
        `You are onboarding a junior software engineer and explaining to them the purpose of the "{fileName}" file.
    Here is the code:
    -----------
    {code}
    -----------
    Generate a summary of no more than 100 words.`,
    ],
]);
// const llm = new ChatAnthropic({
//   model: "claude-3-5-sonnet-20240620",
//   temperature: 0,
//   apiKey: process.env.CLAUDE_API_KEY,
// });
// const llm = new ChatOpenAI({
//   model: "gpt-4-turbo",
//   apiKey: process.env.OPENAI_API_KEY,-
// });
const llm = new google_genai_1.ChatGoogleGenerativeAI({
    model: "gemini-1.5-flash",
    temperature: 0,
    maxRetries: 2,
    apiKey: process.env.GOOGLE_API_KEY,
});
// const llm = new ChatGroq({
//   model: "llama3-8b-8192",
//   temperature: 0,
//   maxRetries: 2,
//   apiKey: process.env.GROQ_API_KEY,
// });
const embeddings = new google_genai_1.GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004",
    taskType: generative_ai_1.TaskType.RETRIEVAL_DOCUMENT,
    title: "Document title",
});
// const embeddings = new CohereEmbeddings({
//   model: "embed-english-v3.0",
//   apiKey: process.env.COHERE_API_KEY,
// });
const indexGithubRepo = async (projectId, github_url, branch = "main", github_token) => {
    console.log("Calling");
    try {
        // const { data: docs } = await loadGithubRepo(
        //   github_url,
        //   branch,
        //   github_token
        // );
        // console.log(docs);
        const res = await axios_1.default.get(`${process.env.PYTHON_BACKEND_URL}/tree?github_url=${github_url}`);
        // console.log(res.data);
        const files = parseFiles(res.data.content);
        const allEmbeddings = await (0, exports.generateAllEmbeddings)(files);
        const filteredEmbeddings = allEmbeddings
            .filter((result) => result.status === "fulfilled" && result.value !== null)
            .map((result) => result.value);
        if (filteredEmbeddings.length === 0) {
            console.log("No embeddings generated. Skipping database insertion.");
            return;
        }
        await drizzle_1.db.insert(schema_1.sourceCodeEmbeddingTable).values(filteredEmbeddings.map((embed) => ({
            projectId,
            summary: embed.summary,
            summaryEmbedding: embed.embedding,
            sourceCode: embed.sourceCode,
            fileName: embed.fileName,
        })));
        console.log("Successfully indexed GitHub repository.");
    }
    catch (error) {
        console.error("Error indexing GitHub repository:", error);
        throw new Error("Failed to index GitHub repository.");
    }
};
exports.indexGithubRepo = indexGithubRepo;
const extensionIndexGithubRepo = async (extensionProjectId, github_url, branch = "main", github_token) => {
    // console.log("Calling");
    try {
        // const { data: docs } = await loadGithubRepo(
        //   github_url,
        //   branch,
        //   github_token
        // );
        // console.log(docs);
        const res = await axios_1.default.get(`${process.env.PYTHON_BACKEND_URL}/tree?github_url=${github_url}`);
        // console.log(res.data);
        const files = parseFiles(res.data.content);
        const allEmbeddings = await (0, exports.generateAllEmbeddings)(files);
        const filteredEmbeddings = allEmbeddings
            .filter((result) => result.status === "fulfilled" && result.value !== null)
            .map((result) => result.value);
        if (filteredEmbeddings.length === 0) {
            console.log("No embeddings generated. Skipping database insertion.");
            return;
        }
        await drizzle_1.db.insert(schema_1.extensionSourceCodeEmbeddingTable).values(filteredEmbeddings.map((embed) => ({
            extensionProjectId,
            summary: embed.summary,
            summaryEmbedding: embed.embedding,
            sourceCode: embed.sourceCode,
            fileName: embed.fileName,
        })));
        console.log("Successfully indexed GitHub repository.");
    }
    catch (error) {
        console.error("Error indexing GitHub repository:", error);
        throw new Error("Failed to index GitHub repository.");
    }
};
exports.extensionIndexGithubRepo = extensionIndexGithubRepo;
function parseFiles(data) {
    const files = {};
    const sections = data.split(/================================================\nFile: /);
    sections.slice(1).forEach((section) => {
        const lines = section.split("\n");
        const filename = lines.shift()?.trim();
        const content = lines.join("\n").trim();
        if (filename) {
            files[filename] = content;
        }
    });
    return files;
}
const generateAllEmbeddings = async (docs) => {
    const fileEntries = Object.entries(docs);
    const batchSize = 15;
    const delayBetweenBatches = 10000;
    // console.log(docs);
    let results = [];
    for (let i = 0; i < fileEntries.length; i += batchSize) {
        const batch = fileEntries.slice(i, i + batchSize);
        console.log(`Processing batch ${i / batchSize + 1}/${Math.ceil(fileEntries.length / batchSize)}`);
        const batchResults = await Promise.allSettled(batch.map(async ([fileName, code]) => {
            try {
                if (fileName.startsWith(".git") || fileName.startsWith("/.git")) {
                    return null;
                }
                const summarizedCode = code.slice(0, 8000);
                const summary = await (0, exports.generateSummary)(fileName, summarizedCode);
                // const res = await axios.post(
                //   `${process.env.PYTHON_BACKEND_URL}/summarize`,
                //   {
                //     fileName,
                //     code: summarizedCode,
                //   }
                // );
                // const summary = res.data.summary;
                if (!summary) {
                    console.warn("Skipping document due to empty summary:", fileName);
                    return null;
                }
                const embed = await (0, exports.generateEmbeddings)(summary);
                return {
                    summary,
                    embedding: embed,
                    sourceCode: code,
                    fileName: fileName,
                };
            }
            catch (error) {
                console.error("Error processing document:", fileName, error);
                return null;
            }
        }));
        results = results.concat(batchResults);
        if (i + batchSize < fileEntries.length) {
            console.log(`Waiting for ${delayBetweenBatches / 1000} seconds to avoid rate limits...`);
            await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
        }
    }
    return results;
};
exports.generateAllEmbeddings = generateAllEmbeddings;
const generateSummary = async (filename, code) => {
    try {
        const slicedCode = code.slice(0, 8000);
        const chain = summaryPrompt.pipe(llm);
        const res = await chain.invoke({ fileName: filename, code: slicedCode });
        if (!res || !res.content) {
            console.warn("Empty response from LLM. Skipping this document.");
            return "";
        }
        return res.content;
    }
    catch (error) {
        console.error("Error generating summary:", error);
        return "";
    }
};
exports.generateSummary = generateSummary;
const generateEmbeddings = async (summarizedCode) => {
    if (!summarizedCode) {
        throw new Error("Cannot generate embeddings for an empty summary.");
    }
    try {
        return await embeddings.embedQuery(summarizedCode);
    }
    catch (error) {
        console.error("Error generating embeddings:", error);
        throw new Error("Failed to generate embeddings.");
    }
};
exports.generateEmbeddings = generateEmbeddings;
