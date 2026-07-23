-- Only KZT can be the active base currency.
ALTER TABLE "currencies"
ADD CONSTRAINT "currencies_base_currency_check"
CHECK (
    ("code" = 'KZT' AND "is_base" = true AND "is_active" = true)
    OR
    ("code" <> 'KZT' AND "is_base" = false)
);

-- Exchange rates are positive and are not stored for the base currency.
ALTER TABLE "exchange_rates"
ADD CONSTRAINT "exchange_rates_value_check"
CHECK ("rate" > 0 AND "currency_code" <> 'KZT');
