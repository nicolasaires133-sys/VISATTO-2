// Camada de banco de dados.
// - Em produção: Postgres (Neon) via DATABASE_URL.
// - Em desenvolvimento local, sem DATABASE_URL: PGlite (Postgres embutido, salvo em ./.data).
// As duas opções têm a mesma interface: query(sql, params) -> linhas.

type Row = Record<string, any>;
export type DB = {
  query: <T = Row>(sql: string, params?: unknown[]) => Promise<T[]>;
  exec: (sql: string) => Promise<void>;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  whatsapp TEXT DEFAULT '',
  address TEXT DEFAULT '',
  primary_color TEXT DEFAULT '#E4572E',
  delivery_enabled BOOLEAN DEFAULT TRUE,
  dine_in_enabled BOOLEAN DEFAULT TRUE,
  delivery_fee_cents INTEGER DEFAULT 0,
  min_order_cents INTEGER DEFAULT 0,
  ai_name TEXT DEFAULT 'Garçom',
  ai_tone TEXT DEFAULT 'simpático e direto',
  ai_instructions TEXT DEFAULT '',
  plan TEXT DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS categories_rest ON categories(restaurant_id);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  image TEXT DEFAULT '',
  serves INTEGER DEFAULT 1,
  tags JSONB DEFAULT '[]'::jsonb,
  available BOOLEAN DEFAULT TRUE,
  featured BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS items_rest ON items(restaurant_id);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  channel TEXT NOT NULL,
  table_label TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'novo',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  ai_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_rest_created ON orders(restaurant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id TEXT,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  notes TEXT DEFAULT '',
  via_ai BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS chat_events (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  channel TEXT DEFAULT '',
  question TEXT NOT NULL,
  answer TEXT DEFAULT '',
  added_items INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_events_rest ON chat_events(restaurant_id, created_at DESC);

-- v2: prato em 3D / realidade aumentada
ALTER TABLE items ADD COLUMN IF NOT EXISTS model_status TEXT DEFAULT 'nenhum';
ALTER TABLE items ADD COLUMN IF NOT EXISTS model_glb_url TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS model_usdz_url TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS model_src_url TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS model_task_id TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS model_error TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS model_width_cm REAL DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS model_dims JSONB DEFAULT '{}'::jsonb;
ALTER TABLE items ADD COLUMN IF NOT EXISTS model_progress INTEGER DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS model_published BOOLEAN DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS model_updated_at TIMESTAMPTZ;

-- v2: métricas de uso (visualizações em 3D/AR)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  item_id TEXT,
  session_id TEXT DEFAULT '',
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS events_rest ON events(restaurant_id, created_at DESC);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id TEXT DEFAULT '';

-- v3: sessões de escaneamento pelo celular (link/QR sem login, expira em 3 horas)
CREATE TABLE IF NOT EXISTS scan_sessions (
  token TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE items ADD COLUMN IF NOT EXISTS model_target_dims JSONB DEFAULT '{}'::jsonb;
ALTER TABLE items ADD COLUMN IF NOT EXISTS model_source TEXT DEFAULT '';

-- v4: pausar pedidos, forma de pagamento, chamados da mesa, limite de tentativas
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS accepting_orders BOOLEAN DEFAULT TRUE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS pix_key TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS change_for_cents INTEGER DEFAULT 0;
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_label TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  done_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS calls_rest ON calls(restaurant_id, status, created_at DESC);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rate_limits_key ON rate_limits(key, at DESC);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- v2: número do pedido único por restaurante
CREATE UNIQUE INDEX IF NOT EXISTS orders_rest_number ON orders(restaurant_id, number);
`;

const g = globalThis as unknown as { __gia_db?: Promise<DB> };

/** Endereço do banco: aceita os nomes que a Vercel/Neon criam sozinhos. */
export function databaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_POSTGRES_URL ||
    process.env.STORAGE_URL ||
    process.env.NEON_DATABASE_URL ||
    ""
  );
}

async function connect(): Promise<DB> {
  let db: DB;
  const url = databaseUrl();
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5 });
    db = {
      query: async (sql, params) => (await pool.query(sql, params as any[])).rows,
      exec: async (sql) => {
        // trava para que duas instâncias não criem/alterem tabelas ao mesmo tempo
        const client = await pool.connect();
        try {
          await client.query("SELECT pg_advisory_lock(727001)");
          await client.query(sql);
        } finally {
          await client.query("SELECT pg_advisory_unlock(727001)").catch(() => {});
          client.release();
        }
      },
    };
  } else {
    if (process.env.VERCEL) {
      throw new Error("Banco de dados não configurado: ligue o Neon na aba Storage do projeto da Vercel e publique de novo.");
    }
    const { PGlite } = await import("@electric-sql/pglite");
    const fs = await import("node:fs");
    fs.mkdirSync("./.data", { recursive: true });
    const lite = new PGlite("./.data/pglite");
    db = {
      query: async (sql, params) => (await lite.query(sql, params as any[])).rows as any[],
      exec: async (sql) => {
        await lite.exec(sql);
      },
    };
  }
  await db.exec(SCHEMA);
  return db;
}

export function getDB(): Promise<DB> {
  if (!g.__gia_db) {
    g.__gia_db = connect().catch((e) => {
      g.__gia_db = undefined;
      throw e;
    });
  }
  return g.__gia_db;
}

export function newId() {
  return crypto.randomUUID();
}
