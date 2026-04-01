ALTER TABLE "File"
ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "share_token" TEXT;

CREATE UNIQUE INDEX "File_share_token_key" ON "File"("share_token");
