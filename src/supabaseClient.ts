// src/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL) throw new Error("Falta SUPABASE_URL en el .env");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el .env");
if (!SUPABASE_ANON_KEY) throw new Error("Falta SUPABASE_ANON_KEY en el .env");

// ✅ Admin (service_role): DB + Auth Admin
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ✅ Anon (para validar tokens que llegan del frontend)
export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
