-- Включаем pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Нормативные документы
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  file_name text,
  chunk_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Чанки с embeddings (1536d = text-embedding-3-small)
CREATE TABLE IF NOT EXISTS document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

-- Индекс для векторного поиска (cosine similarity)
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Диалоги
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

-- Сообщения
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  sources jsonb DEFAULT '[]',
  feedback smallint CHECK (feedback IN (-1, 1)),
  response_time_ms int,
  created_at timestamptz DEFAULT now()
);

-- Функция векторного поиска
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
  similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.content,
    c.metadata,
    d.name AS document_name,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM document_chunks c
  JOIN documents d ON d.id = c.document_id
  WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
