const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = require('./env');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

function isNoRowsError(error) {
  if (!error) return false;
  return error.code === 'PGRST116' || /0 rows/i.test(error.message || '');
}

module.exports = {
  supabase,
  isNoRowsError
};
