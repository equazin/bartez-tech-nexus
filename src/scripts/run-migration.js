
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const sql = fs.readFileSync('supabase/migrations/038_product_cost_currency.sql', 'utf8');
  console.log("Executing SQL migration...");
  
  // NOTE: Supabase JS client doesn't have a raw SQL method. 
  // We use an RPC if available, or we advise the user.
  // Checking for 'exec_sql' RPC which is commonly used.
  
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  
  if (error) {
    if (error.message.includes("function exec_sql(text) does not exist")) {
      console.error("\n[ERROR] No 'exec_sql' RPC function found in your Supabase project.");
      console.error("Please run the SQL manually in the Supabase Dashboard SQL Editor:");
      console.error("------------------------------------------------------------");
      console.error(sql);
      console.error("------------------------------------------------------------");
    } else {
      console.error("Error executing SQL:", error.message);
    }
  } else {
    console.log("SQL executed successfully!");
  }
}

run();
