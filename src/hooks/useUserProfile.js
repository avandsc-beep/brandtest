import { useCallback, useState } from 'react';
import { supabaseClient } from '../lib/supabaseClient.js';

const STORAGE_KEY = 'brandex_profile';
export const PROFILES = ['general', 'disenador', 'experto'];

// Perfil de lectura del resultado — general / disenador / experto. Nunca
// toca el motor de cálculo (src/lib/scoring.js), solo cuánta profundidad
// de la MISMA evaluación se muestra (grilla de indicadores, variables
// crudas). Persiste en users.profile para cuentas registradas, en
// localStorage para invitados — mismo esquema que legacyApp.js
// applyProfile()/currentProfile.
export function useUserProfile({ user, isGuest, patchUser }) {
  const [profile, setProfileState] = useState(() => {
    if (isGuest) return localStorage.getItem(STORAGE_KEY) || 'general';
    return user?.profile || 'general';
  });

  const setProfile = useCallback(
    (next) => {
      setProfileState(next);
      if (isGuest || !user?.id) {
        localStorage.setItem(STORAGE_KEY, next);
        return;
      }
      patchUser({ profile: next });
      supabaseClient.from('users').update({ profile: next }).eq('id', user.id).then(() => {});
    },
    [isGuest, user?.id, patchUser]
  );

  return { profile, setProfile };
}
