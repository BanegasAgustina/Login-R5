// Los hooks consultan disponibilidad; Axios reutiliza la URL de nuestra API.
import { useEffect, useState } from 'react';
import api from '../services/api';
// Logos vectoriales de Simple Icons: se incluyen localmente, sin rastreadores externos.
import { siGoogle, siGithub, siFacebook, siDiscord, siTwitch, siX } from 'simple-icons';

const brands = { google: siGoogle, github: siGithub, facebook: siFacebook, discord: siDiscord, twitch: siTwitch, twitter: siX };
type Provider = { id: keyof typeof brands; name: string; enabled: boolean; url: string | null };
const defaults: Provider[] = Object.entries(brands).map(([id, icon]) => ({ id: id as Provider['id'], name: icon.title, enabled: false, url: null }));

// El backend decide qué proveedores están configurados. Los botones nunca reciben
// Client Secret ni tokens; navegan a la ruta que inicia el intercambio seguro.
export default function OAuthButtons() {
  const [providers, setProviders] = useState(defaults);
  const [status, setStatus] = useState('Consultando proveedores…');
  useEffect(() => {
    let active = true;
    api.get<Provider[]>('/auth/providers').then(({ data }) => {
      if (!active) return;
      setProviders(data.filter(p => Object.hasOwn(brands, p.id)));
      if (import.meta.env.DEV) data.forEach(p => console.info(`[OAuth] ${p.name}: ${p.enabled ? 'enabled' : 'disabled'}`));
      setStatus(data.some(p => !p.enabled) ? 'Los proveedores deshabilitados necesitan configuración.' : '');
    }).catch(() => { if (active) setStatus('No se pudo consultar los proveedores. Podés usar email y contraseña.'); });
    return () => { active = false; };
  }, []);

  return (
    <div className="oauth-section">
      <div className="oauth-divider"><span>o continuar con</span></div>
      <div className="oauth-grid">
        {providers.map(p => (
          <button className="oauth-button" type="button" key={p.id} disabled={!p.enabled}
            title={!p.enabled ? `${p.name}: pendiente de configuración` : undefined}
            onClick={() => { if (p.url) window.location.assign(p.url); }}>
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d={brands[p.id].path} /></svg>
            <span>Continuar con {p.name}</span>
          </button>
        ))}
      </div>
      {status && <small className="oauth-status" role="status">{status}</small>}
    </div>
  );
}
