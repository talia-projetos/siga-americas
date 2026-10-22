-- Conferência física independente do livro de entradas e saídas.
-- A quantidade observada não gera movimentação de estoque.
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS counted_quantity numeric NULL CHECK(counted_quantity >= 0);
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS counted_at timestamptz NULL;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS count_evidence text NULL;
COMMENT ON COLUMN public.stock_items.counted_quantity IS 'Última contagem física informada, sem conciliação automática com movimentações.';
COMMENT ON COLUMN public.stock_items.counted_at IS 'Momento do registro da última contagem física.';
COMMENT ON COLUMN public.stock_items.count_evidence IS 'Local e documento de referência da contagem física.';
