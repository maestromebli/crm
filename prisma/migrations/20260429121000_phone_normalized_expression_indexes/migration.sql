-- Speed up duplicate checks by indexing normalized phone digits.
-- Keep expression-based indexes to avoid schema churn in application models.

CREATE INDEX IF NOT EXISTS "Lead_phone_digits_idx"
  ON "Lead" ((regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')))
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Contact_phone_digits_idx"
  ON "Contact" ((regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')))
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Lead_phone_tail10_idx"
  ON "Lead" ((right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10)))
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Contact_phone_tail10_idx"
  ON "Contact" ((right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10)))
  WHERE phone IS NOT NULL;
