-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_slug" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,
    "last_seen_at" BIGINT NOT NULL,
    "feedback_done" BOOLEAN NOT NULL DEFAULT false,
    "unlocked_at" BIGINT
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" TEXT NOT NULL,
    "event_slug" TEXT NOT NULL,
    "prompt_id" TEXT NOT NULL,
    "client_capture_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "received_at" BIGINT NOT NULL,
    CONSTRAINT "submissions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "claims" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "event_slug" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "student_email" TEXT NOT NULL,
    "claim_token" TEXT NOT NULL,
    "short_code" TEXT NOT NULL,
    "loot_snapshot" TEXT NOT NULL,
    "is_claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimed_at" BIGINT,
    "claimed_by_marshal" TEXT,
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "feedback_responses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" TEXT NOT NULL,
    "event_slug" TEXT NOT NULL,
    "answers_json" TEXT NOT NULL,
    "submitted_at" BIGINT NOT NULL,
    CONSTRAINT "feedback_responses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "marshal_sessions" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "created_at" BIGINT NOT NULL,
    "expires_at" BIGINT NOT NULL,
    "label" TEXT
);

-- CreateIndex
CREATE INDEX "sessions_event_slug_idx" ON "sessions"("event_slug");

-- CreateIndex
CREATE INDEX "submissions_session_id_idx" ON "submissions"("session_id");

-- CreateIndex
CREATE INDEX "submissions_event_slug_prompt_id_idx" ON "submissions"("event_slug", "prompt_id");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_session_id_prompt_id_key" ON "submissions"("session_id", "prompt_id");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_session_id_client_capture_id_key" ON "submissions"("session_id", "client_capture_id");

-- CreateIndex
CREATE UNIQUE INDEX "claims_session_id_key" ON "claims"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "claims_claim_token_key" ON "claims"("claim_token");

-- CreateIndex
CREATE INDEX "claims_claim_token_idx" ON "claims"("claim_token");

-- CreateIndex
CREATE UNIQUE INDEX "claims_event_slug_student_email_key" ON "claims"("event_slug", "student_email");

-- CreateIndex
CREATE UNIQUE INDEX "claims_event_slug_short_code_key" ON "claims"("event_slug", "short_code");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_responses_session_id_key" ON "feedback_responses"("session_id");

-- CreateIndex
CREATE INDEX "marshal_sessions_expires_at_idx" ON "marshal_sessions"("expires_at");
