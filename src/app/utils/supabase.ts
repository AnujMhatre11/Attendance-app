import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const supabase = createClient(
  "https://qqcbuakhldnufiiwchth.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxY2J1YWtobGRudWZpaXdjaHRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwNzcwNTAsImV4cCI6MjA1MTY1MzA1MH0.j0lL0dFNL4faRPiQOWteumNkKVFT_5lM0xR9MTQxb6Q",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

