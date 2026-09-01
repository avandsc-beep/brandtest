import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseClient } from '../lib/supabaseClient.js';

const GUEST_USER = {
  id: null, email: null, name: 'Invitado', whatsapp: null,
  credits: 0, plan: 'libre', last_free_analysis: null, total_analyses: 0, is_admin: false,
};

// Trae (o crea, si el disparador de la base de datos aún no terminó) la
// fila de public.users del usuario autenticado. Ported de legacyApp.js
// loadUserProfile().
async function loadUserProfile(authUser) {
  let { data } = await supabaseClient.from('users').select('*').eq('id', authUser.id).single();
  if (!data) {
    await new Promise((r) => setTimeout(r, 900));
    ({ data } = await supabaseClient.from('users').select('*').eq('id', authUser.id).single());
  }
  const avatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null;
  if (data) {
    return { ...data, avatar_url: avatarUrl };
  }
  return {
    id: authUser.id, email: authUser.email,
    name: authUser.user_metadata?.full_name || authUser.email,
    whatsapp: null, credits: 10, plan: 'libre',
    last_free_analysis: null, total_analyses: 0, is_admin: false, avatar_url: avatarUrl,
  };
}

/**
 * Estado de sesión real, compartido por toda la app post-login. Reemplaza
 * la lógica equivalente de src/legacy/legacyApp.js (loadUserProfile /
 * initAuth / useAsGuest / loginWithGoogle / logout), con el mismo cliente
 * de Supabase (src/lib/supabaseClient.js) para que ambos sistemas vean la
 * misma sesión mientras dure la migración.
 */
export function useSupabaseAuth() {
  // 'checking' | 'anonymous' | 'guest' | 'authed'
  const [status, setStatus] = useState('checking');
  const [user, setUser] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let sub;
    (async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        const profile = await loadUserProfile(session.user);
        if (mountedRef.current) {
          setUser(profile);
          setStatus('authed');
        }
      } else if (mountedRef.current) {
        setStatus('anonymous');
      }
      const { data } = supabaseClient.auth.onAuthStateChange(async (event, sess) => {
        if (event === 'SIGNED_IN' && sess) {
          const profile = await loadUserProfile(sess.user);
          if (mountedRef.current) {
            setUser(profile);
            setStatus('authed');
          }
        } else if (event === 'SIGNED_OUT') {
          if (mountedRef.current) {
            setUser(null);
            setStatus('anonymous');
          }
        }
      });
      sub = data?.subscription;
    })();
    return () => {
      mountedRef.current = false;
      sub?.unsubscribe();
    };
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error };
  }, []);

  // Invitado: 1 análisis gratis cada 48h, solo por localStorage (no hay
  // cuenta ni fila de DB que proteger). Devuelve {allowed, message} igual
  // que checkGuestPermission/useAsGuest original.
  const enterAsGuest = useCallback(() => {
    const last = localStorage.getItem('brandtest_guest_last_use');
    if (last) {
      const hoursSince = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 48) {
        return {
          allowed: false,
          message: 'Ya usaste tu análisis gratuito sin registro. Vuelve en ' + Math.ceil(48 - hoursSince) + ' horas, o crea una cuenta gratis para seguir usando la app ahora.',
        };
      }
    }
    setUser({ ...GUEST_USER });
    setStatus('guest');
    return { allowed: true };
  }, []);

  const logout = useCallback(async () => {
    if (status === 'guest') {
      setUser(null);
      setStatus('anonymous');
      return;
    }
    await supabaseClient.auth.signOut();
  }, [status]);

  // Actualiza el usuario en memoria con lo que confirmó el servidor
  // (créditos/plan/whatsapp) — nunca con cálculos optimistas del cliente.
  const patchUser = useCallback((patch) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }, []);

  return {
    status,
    user,
    isGuest: status === 'guest',
    loginWithGoogle,
    enterAsGuest,
    logout,
    patchUser,
  };
}
