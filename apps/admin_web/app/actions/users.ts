"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export async function createUser(payload: { email: string; full_name: string; role: string; shop_id?: string }) {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const userClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet: any[]) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { }
      },
    },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { error: "unauthorized" };

  const { data: profile } = await userClient
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active || profile.role !== "admin") return { error: "forbidden" };

  const admin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);

  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: payload.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: payload.full_name,
    }
  });

  if (authErr) return { error: "internal_server_error", details: authErr.message };

  const userId = authData.user.id;

  const { error: profErr } = await admin
    .from("profiles")
    .update({
      full_name: payload.full_name,
      role: payload.role,
      shop_id: payload.shop_id || null,
      is_active: true,
    })
    .eq("id", userId);

  if (profErr) return { error: "internal_server_error", details: profErr.message };

  return { ok: true, id: userId, tempPassword };
}

export async function updateUserStatus(userId: string, isActive: boolean) {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const userClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet: any[]) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { }
      },
    },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { error: "unauthorized" };

  const { data: profile } = await userClient
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active || profile.role !== "admin") return { error: "forbidden" };

  const admin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  const { error } = await admin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);

  if (error) return { error: "internal_server_error", details: error.message };
  return { ok: true };
}
