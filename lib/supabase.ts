import { createClient } from '@supabase/supabase-js';

// We will set these up in Vercel later when you deploy
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to get or create a persistent user ID for this browser
export const getUserId = () => {
  if (typeof window === 'undefined') return 'server_render'; // Safety check for Next.js
  
  let userId = localStorage.getItem('plo6_user_id');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('plo6_user_id', userId);
  }
  return userId;
};