-- CreateTable
CREATE TABLE "user_table_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "table_key" TEXT NOT NULL,
    "columns" JSONB NOT NULL,

    CONSTRAINT "user_table_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_table_settings_user_id_table_key_key"
ON "user_table_settings"("user_id", "table_key");

-- AddForeignKey
ALTER TABLE "user_table_settings"
ADD CONSTRAINT "user_table_settings_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
