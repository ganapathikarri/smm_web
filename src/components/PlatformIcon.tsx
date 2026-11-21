/** Deterministic inline SVG icons keyed by the platform CODE. No external image fetch, upload or DB migration required. */
import { Facebook, Globe2, Instagram, Linkedin, MessageCircle, Music2, Play, Send, Youtube } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

const palettes: Record<string, { background: string; foreground: string }> = {
  INSTAGRAM: { background: 'linear-gradient(135deg,#f9ce34 0%,#ee2a7b 50%,#6228d7 100%)', foreground: '#fff' },
  FACEBOOK: { background: '#1877F2', foreground: '#fff' },
  YOUTUBE: { background: '#FF0033', foreground: '#fff' },
  LINKEDIN: { background: '#0A66C2', foreground: '#fff' },
  TWITTER: { background: '#1DA1F2', foreground: '#fff' },
  X: { background: '#14171A', foreground: '#fff' },
  TIKTOK: { background: '#171717', foreground: '#fff' },
  WHATSAPP: { background: '#25D366', foreground: '#fff' },
  TELEGRAM: { background: '#229ED9', foreground: '#fff' },
  PINTEREST: { background: '#BD081C', foreground: '#fff' },
  SNAPCHAT: { background: '#FFFC00', foreground: '#171717' },
  REDDIT: { background: '#FF4500', foreground: '#fff' },
  THREADS: { background: '#151515', foreground: '#fff' },
};

export default function PlatformIcon({ code, name, size = 44 }: { code: string; name?: string; size?: number }) {
  const key = String(code || '').trim().toUpperCase();
  const palette = palettes[key] ?? { background: '#E9EBFA', foreground: '#6254BA' };
  const iconSize = Math.round(size * .51);
  const icons: Record<string, ReactNode> = {
    INSTAGRAM: <Instagram size={iconSize} strokeWidth={2.25} />,
    FACEBOOK: <Facebook size={iconSize} strokeWidth={2.2} />,
    YOUTUBE: <Youtube size={iconSize} fill="currentColor" strokeWidth={1.8} />,
    LINKEDIN: <Linkedin size={iconSize} strokeWidth={2.1} />,
    TWITTER: <span style={{ fontSize: iconSize * .8, fontWeight: 800 }}>𝕏</span>,
    X: <span style={{ fontSize: iconSize * 1.1, fontWeight: 600 }}>𝕏</span>,
    TIKTOK: <Music2 size={iconSize} strokeWidth={2.4} />,
    WHATSAPP: <MessageCircle size={iconSize} strokeWidth={2.2} />,
    TELEGRAM: <Send size={iconSize} fill="currentColor" strokeWidth={1.6} />,
    PINTEREST: <span style={{ fontSize: iconSize, fontWeight: 800, fontFamily: 'Georgia,serif' }}>P</span>,
    SNAPCHAT: <span style={{ fontSize: iconSize * .8, fontWeight: 800 }}>S</span>,
    REDDIT: <MessageCircle size={iconSize} strokeWidth={2} />,
    THREADS: <span style={{ fontSize: iconSize, fontWeight: 800 }}>@</span>,
  };
  const fallback = key.includes('VIDEO') ? <Play size={iconSize} /> : key.includes('SOCIAL') ? <Globe2 size={iconSize} /> : <span style={{ fontSize: iconSize * .62, fontWeight: 800 }}>{(name || key || 'PL').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || 'PL'}</span>;
  const style: CSSProperties = { width: size, height: size, borderRadius: Math.round(size * .27), flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: palette.background, color: palette.foreground, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.04)', verticalAlign: 'middle' };
  return <span role="img" aria-label={`${name || key} platform icon`} title={name || key} style={style}>{icons[key] ?? fallback}</span>;
}
