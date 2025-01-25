import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const supabase2 = createClient(
  "https://bogosjbvzcfcldahqzqv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvZ29zamJ2emNmY2xkYWhxenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NTg2NjEsImV4cCI6MjA1MjQzNDY2MX0.UlaFnLDqXJgVF9tYCOL0c0hjCAd4__Yq47K5mVYdXcc",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

