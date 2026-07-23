-- The tax-rate migration is ordered after the currency migration on a fresh
-- database, so index normalization must also run after tax-rate creation.
DO $$
BEGIN
  IF to_regclass('"legal_entity_tax_rates_legal_entity_id_kind_effective_fr_key"') IS NOT NULL
     AND to_regclass('"legal_entity_tax_rates_legal_entity_id_kind_effective_from_key"') IS NULL THEN
    ALTER INDEX "legal_entity_tax_rates_legal_entity_id_kind_effective_fr_key"
      RENAME TO "legal_entity_tax_rates_legal_entity_id_kind_effective_from_key";
  END IF;

  IF to_regclass('"legal_entity_tax_rates_legal_entity_id_kind_effective_fro_idx"') IS NOT NULL
     AND to_regclass('"legal_entity_tax_rates_legal_entity_id_kind_effective_from_idx"') IS NULL THEN
    ALTER INDEX "legal_entity_tax_rates_legal_entity_id_kind_effective_fro_idx"
      RENAME TO "legal_entity_tax_rates_legal_entity_id_kind_effective_from_idx";
  END IF;
END
$$;
