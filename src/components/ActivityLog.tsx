'use client';

import { useEffect, useState } from 'react';
import { getFullUserStamps } from '@/app/actions/stamps';
import { destinations } from '@/data/destinations';
import { useLanguage } from '@/lib/i18n';
import { Calendar, MapPin, ChevronRight, Award } from 'lucide-react';

interface StampWithDetails {
  id: string;
  destinationId: number;
  stampedAt: Date;
  destinationName: string;
}

export default function ActivityLog({ onSelect }: { onSelect: (id: number) => void }) {
  const [stamps, setStamps] = useState<StampWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();

  useEffect(() => {
    getFullUserStamps().then(data => {
      const enriched = data.map(s => ({
        ...s,
        destinationName: destinations.find(d => d.id === s.destinationId)?.name || 'Unknown'
      }));
      setStamps(enriched);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
      {language === 'nb' ? 'Laster logg...' : 'Loading log...'}
    </div>;
  }

  if (stamps.length === 0) {
    return (
      <div style={{ padding: '30px 20px', textAlign: 'center', background: '#f9f9f9', borderRadius: '8px' }}>
        <Award size={32} color="#ccc" style={{ marginBottom: '10px' }} />
        <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
          {language === 'nb' ? 'Ingen turer stemplet ennå. Kom deg ut på tur!' : 'No trips stamped yet. Get out there!'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h3 style={{ fontSize: '16px', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Calendar size={18} />
        {language === 'nb' ? 'Dine turer' : 'Your Trips'}
      </h3>
      {stamps.map(stamp => (
        <div 
          key={stamp.id}
          onClick={() => onSelect(stamp.destinationId)}
          style={{ 
            padding: '12px', background: '#fff', border: '1px solid #eee', borderRadius: '8px',
            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>{stamp.destinationName}</div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
               <MapPin size={12} />
               {new Date(stamp.stampedAt).toLocaleDateString(language === 'nb' ? 'no-NO' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <ChevronRight size={16} color="#ccc" />
        </div>
      ))}
    </div>
  );
}
