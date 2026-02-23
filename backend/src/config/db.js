const { supabase } = require('./supabase');

module.exports = async function connectDB() {
  try {
    const { error } = await supabase
      .from('raffles')
      .select('id', { head: true, count: 'exact' })
      .limit(1);

    if (error) {
      throw error;
    }

    console.log('Supabase connected');
  } catch (err) {
    console.error('Supabase connection error', err);
    process.exit(1);
  }
};
