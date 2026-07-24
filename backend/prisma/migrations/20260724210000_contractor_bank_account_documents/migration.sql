-- Добавляем БИК и признак "использовать в документах" к банковским счетам контрагента
ALTER TABLE "contractor_bank_accounts" ADD COLUMN     "bik" TEXT,
ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT false;

-- Переносим единственный набор банковских реквизитов контрагента (bank_name/bank_account/bank_bik),
-- который раньше дублировал список "Банковские счета", в отдельную запись этого списка
-- с пометкой is_primary (решение владельца от 2026-07-24 об устранении дублирования полей).
INSERT INTO "contractor_bank_accounts" ("id", "contractor_id", "bank_name", "account_number", "currency", "bik", "is_primary")
SELECT
  'bkacc_' || substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 20),
  "id",
  "bank_name",
  "bank_account",
  'KZT',
  "bank_bik",
  true
FROM "contractors"
WHERE "bank_name" IS NOT NULL AND btrim("bank_name") <> ''
  AND "bank_account" IS NOT NULL AND btrim("bank_account") <> '';

-- AlterTable
ALTER TABLE "contractors" DROP COLUMN "bank_account",
DROP COLUMN "bank_bik",
DROP COLUMN "bank_name";
