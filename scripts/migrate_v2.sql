-- НормативПро v2 — добавляем поля источников в documents

ALTER TABLE documents ADD COLUMN IF NOT EXISTS page_url text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cntd_id text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS alt_url text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_code text;

-- Обновляем функцию match_chunks — добавляем page_url и doc_code
DROP FUNCTION IF EXISTS match_chunks(vector, float, int);
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  document_name text,
  similarity float,
  page_url text,
  doc_code text
)
LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.content,
    c.metadata,
    d.name AS document_name,
    1 - (c.embedding <=> query_embedding) AS similarity,
    d.page_url,
    d.doc_code
  FROM document_chunks c
  JOIN documents d ON d.id = c.document_id
  WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
