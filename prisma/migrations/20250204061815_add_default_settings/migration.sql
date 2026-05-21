-- Create default settings record if none exists
INSERT INTO "Settings" ("id", "telegramEnabled", "telegramSendSilently", "appriseEnabled", "kavitaEnabled", "komgaEnabled")
SELECT 1, false, false, false, false, false
WHERE NOT EXISTS (SELECT * FROM "Settings" LIMIT 1);
