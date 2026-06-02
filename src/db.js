const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { db: { schema: 'midas' } }
);

// Compatibilidade com db.query() usado nas rotas
const db = {
  query: async (sql, params = []) => {
    const { data, error } = await supabase.rpc('exec_sql', { sql, params });
    if (error) throw error;
    return { rows: data || [] };
  }
};

module.exports = db;
