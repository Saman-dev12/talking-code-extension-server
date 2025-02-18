"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extensionSourceCodeEmbeddingRelations = exports.extensionSourceCodeEmbeddingTable = exports.extensionProjectsRelations = exports.extensionProjectsTable = exports.sourceCodeEmbeddingRelations = exports.sourceCodeEmbeddingTable = exports.insertCommitsSchema = exports.commitsRelations = exports.commitsTable = exports.insertProjectsSchema = exports.projectsRelations = exports.projectsTable = exports.usersRelations = exports.usersTable = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const drizzle_zod_1 = require("drizzle-zod");
const pg_core_1 = require("drizzle-orm/pg-core");
exports.usersTable = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    image: (0, pg_core_1.text)("image"),
    password: (0, pg_core_1.varchar)("password", { length: 255 }),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.usersTable, ({ many }) => ({
    projects: many(exports.projectsTable),
}));
exports.projectsTable = (0, pg_core_1.pgTable)("projects", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    githubUrl: (0, pg_core_1.text)("github_url").notNull(),
    userId: (0, pg_core_1.uuid)("user_id")
        .references(() => exports.usersTable.id, {
        onDelete: "cascade",
    })
        .notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    deletedAt: (0, pg_core_1.timestamp)("deleted_at"),
    treeStructure: (0, pg_core_1.text)("tree_structure").notNull(),
});
exports.projectsRelations = (0, drizzle_orm_1.relations)(exports.projectsTable, ({ one, many }) => ({
    user: one(exports.usersTable, {
        fields: [exports.projectsTable.userId],
        references: [exports.usersTable.id],
    }),
    commits: many(exports.commitsTable),
    sourceCodeEmbedding: many(exports.sourceCodeEmbeddingTable),
}));
exports.insertProjectsSchema = (0, drizzle_zod_1.createInsertSchema)(exports.projectsTable);
exports.commitsTable = (0, pg_core_1.pgTable)("commits", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    projectId: (0, pg_core_1.uuid)("project_id")
        .references(() => exports.projectsTable.id, {
        onDelete: "cascade",
    })
        .notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
    commitMessage: (0, pg_core_1.text)("commit_message").notNull(),
    commitHash: (0, pg_core_1.text)("commit_hash").notNull(),
    commitAuthorName: (0, pg_core_1.text)("commit_author_name").notNull(),
    commitAuthorAvatar: (0, pg_core_1.text)("commit_author_avatar").notNull(),
    commitDate: (0, pg_core_1.text)("commit_date").notNull(),
    summary: (0, pg_core_1.text)("summary").notNull(),
});
exports.commitsRelations = (0, drizzle_orm_1.relations)(exports.commitsTable, ({ one }) => ({
    project: one(exports.projectsTable, {
        fields: [exports.commitsTable.projectId],
        references: [exports.projectsTable.id],
    }),
}));
exports.insertCommitsSchema = (0, drizzle_zod_1.createInsertSchema)(exports.commitsTable);
exports.sourceCodeEmbeddingTable = (0, pg_core_1.pgTable)("source_code_embedding", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    sourceCode: (0, pg_core_1.text)("source_code").notNull(),
    fileName: (0, pg_core_1.text)("file_name").notNull(),
    summary: (0, pg_core_1.text)("summary").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
    projectId: (0, pg_core_1.uuid)("project_id")
        .references(() => exports.projectsTable.id, {
        onDelete: "cascade",
    })
        .notNull(),
    summaryEmbedding: (0, pg_core_1.vector)("summary_embedding", { dimensions: 768 }),
}, 
// (table) => [
//   index("embeddingIndex").using(
//     "hnsw",
//     table.embedding.op("vector_cosine_ops")
//   ),
// ]
(table) => ({
    embeddingIndex: (0, pg_core_1.index)("embeddingIndex").using("hnsw", table.summaryEmbedding.op("vector_cosine_ops")),
}));
exports.sourceCodeEmbeddingRelations = (0, drizzle_orm_1.relations)(exports.sourceCodeEmbeddingTable, ({ one }) => ({
    project: one(exports.projectsTable, {
        fields: [exports.sourceCodeEmbeddingTable.projectId],
        references: [exports.projectsTable.id],
    }),
}));
exports.extensionProjectsTable = (0, pg_core_1.pgTable)("extension_projects", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    githubUrl: (0, pg_core_1.text)("github_url").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.extensionProjectsRelations = (0, drizzle_orm_1.relations)(exports.extensionProjectsTable, ({ many }) => ({
    extensionSourceCodeEmbedding: many(exports.extensionSourceCodeEmbeddingTable),
}));
exports.extensionSourceCodeEmbeddingTable = (0, pg_core_1.pgTable)("extension_source_code_embeddings", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    summaryEmbeddings: (0, pg_core_1.vector)("summary_embeddings", { dimensions: 768 }),
    sourceCode: (0, pg_core_1.text)("source_code").notNull(),
    fileName: (0, pg_core_1.text)("file_name").notNull(),
    summary: (0, pg_core_1.text)("summary").notNull(),
    extensionProjectId: (0, pg_core_1.uuid)("extension_projectId")
        .references(() => exports.extensionProjectsTable.id, {
        onDelete: "cascade",
    })
        .notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.extensionSourceCodeEmbeddingRelations = (0, drizzle_orm_1.relations)(exports.extensionSourceCodeEmbeddingTable, ({ one }) => ({
    extensionProject: one(exports.extensionProjectsTable, {
        fields: [exports.extensionSourceCodeEmbeddingTable.extensionProjectId],
        references: [exports.extensionProjectsTable.id],
    }),
}));
