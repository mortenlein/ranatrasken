'use client';

import { useSession, signIn, signOut } from "next-auth/react";
import { useLanguage } from "@/lib/i18n";
import { LogIn, LogOut, User } from "lucide-react";

export default function UserMenu() {
  const { data: session } = useSession();
  const { language } = useLanguage();

  if (session) {
    return (
      <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '15px', border: '1px solid #eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <User size={14} color="#666" />
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
            {language === 'nb' ? 'Logget inn som:' : 'Logged in as:'}
          </p>
        </div>
        <p style={{ margin: '0 0 12px 0', fontWeight: 'bold', fontSize: '14px' }}>{session.user?.name || session.user?.email}</p>
        <button 
          onClick={() => signOut()}
          style={{ 
            width: '100%', padding: '8px', fontSize: '12px', background: '#fff', color: '#dc3545', 
            border: '1px solid #dc3545', borderRadius: '4px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#dc3545'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#dc3545'; }}
        >
          <LogOut size={14} />
          {language === 'nb' ? 'Logg ut' : 'Sign Out'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '15px', background: '#e7f1ff', borderRadius: '8px', marginBottom: '15px', border: '1px solid #b8daff' }}>
      <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#004085', fontWeight: '500' }}>
        {language === 'nb' ? 'Logg inn for å stemple!' : 'Sign in to start stamping!'}
      </p>
      <button 
        onClick={() => signIn()}
        style={{ 
          width: '100%', padding: '8px', fontSize: '12px', background: '#007bff', color: '#fff', 
          border: 'none', borderRadius: '4px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,123,255,0.2)'
        }}>
        <LogIn size={14} />
        {language === 'nb' ? 'Logg inn' : 'Sign In'}
      </button>
    </div>
  );
}
