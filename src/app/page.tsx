'use client';

import { useRef, useState, useEffect, useSyncExternalStore } from 'react';
import MapComponent, { MapRef } from '@/components/MapComponent';
import { destinations, Destination, difficultyMeta, DifficultyLevel } from '@/data/destinations';
import UserMenu from '@/components/UserMenu';
import ActivityLog from '@/components/ActivityLog';
import { useLanguage } from '@/lib/i18n';
import { useSession } from 'next-auth/react';
import { stampDestination, getUserStamps } from '@/app/actions/stamps';
import { CheckCircle, Award, List, History, MapPin, Menu, X } from 'lucide-react';

// Phone-sized viewport, kept in sync via useSyncExternalStore (SSR-safe: the
// server snapshot says desktop, the client corrects after hydration).
const MOBILE_MQ = '(max-width: 768px)';
const subscribeToMobileMq = (onChange: () => void) => {
  const mq = window.matchMedia(MOBILE_MQ);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};
const isMobileNow = () => window.matchMedia(MOBILE_MQ).matches;
const isMobileOnServer = () => false;

export default function Home() {
  const mapRef = useRef<MapRef>(null);
  const { language, setLanguage, t } = useLanguage();
  const { data: session } = useSession();
  const [view, setView] = useState<'explore' | 'history'>('explore');
  const [filterAge, setFilterAge] = useState<number | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<DifficultyLevel | null>(null);
  const [selectedDest, setSelectedDest] = useState<Destination | null>(null);
  const [mapStyle, setMapStyle] = useState('outdoor-v2');
  const [userStamps, setUserStamps] = useState<number[]>([]);
  const [isStamping, setIsStamping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useSyncExternalStore(subscribeToMobileMq, isMobileNow, isMobileOnServer);

  // On phone-sized viewports the sidebar is a drawer that starts closed, so
  // the map is what you land on. (Post-hydration effect, not initial state:
  // the page is prerendered without a window, and hydration must match.)
  useEffect(() => {
    if (window.matchMedia(MOBILE_MQ).matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSidebarOpen(false);
    }
  }, []);
  const isAdmin = session?.user?.email?.includes('admin') ?? false;
  
  // Admin Curation State
  const [adminMode, setAdminMode] = useState(false);
  const [adminSegments, setAdminSegments] = useState<number[][][]>([]);
  const [isSavingRoute, setIsSavingRoute] = useState(false);

  const handleSegmentSelect = (segments: number[][][]) => {
    setAdminSegments(prev => [...prev, ...segments]);
  };

  const handleClearSegments = () => {
    setAdminSegments([]);
  };

  const saveAdminRoute = async () => {
    if (!selectedDest || adminSegments.length === 0) return;
    setIsSavingRoute(true);
    try {
      const response = await fetch('/api/admin/save-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destId: selectedDest.id,
          geometry: {
            type: 'MultiLineString',
            coordinates: adminSegments
          }
        })
      });
      if (response.ok) {
        alert('Route saved successfully! Reload the page to see the updated curated route.');
        setAdminSegments([]);
      } else {
        alert('Failed to save route.');
      }
    } catch (e) {
      console.error(e);
      alert('Error saving route.');
    } finally {
      setIsSavingRoute(false);
    }
  };

  useEffect(() => {
    if (session) {
      getUserStamps().then(setUserStamps);
    } else {
      setTimeout(() => {
        setUserStamps([]);
        setView('explore');
      }, 0);
    }
  }, [session]);

  const handleSelectFromHistory = (id: number) => {
    const dest = destinations.find(d => d.id === id);
    if (dest) {
      setSelectedDest(dest);
      setView('explore');
      mapRef.current?.flyTo(dest);
      if (isMobile) setSidebarOpen(false);
    }
  };

  const handleStamp = async (id: number) => {
    if (!session) return;
    setIsStamping(true);
    try {
      const res = await stampDestination(id);
      if (res.success) {
        setUserStamps([...userStamps, id]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsStamping(false);
    }
  };

  const filteredDestinations = destinations.filter(d => {
    const ageMatch = !filterAge || d.childSuitability >= (filterAge === 6 ? 7 : filterAge === 9 ? 4 : 0);
    const difficultyMatch = !filterDifficulty || d.difficulty === filterDifficulty;
    return ageMatch && difficultyMatch;
  });

  const handleFlyTo = (dest: Destination) => {
    setSelectedDest(dest);
    mapRef.current?.flyTo(dest);
    // Picking a trip on a phone should show the map, not keep it covered.
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <main className="app-main" style={{ width: '100vw', overflow: 'hidden', position: 'relative' }}>
      {/* Sidebar toggle — pinned just outside the drawer edge, clamped so it
          never leaves the viewport on narrow screens. */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'absolute', top: '12px',
          left: sidebarOpen ? 'min(412px, calc(100vw - 52px))' : '12px',
          zIndex: 20, width: '40px', height: '40px',
          background: 'rgba(255,255,255,0.95)', border: '1px solid #ddd',
          borderRadius: '8px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'left 0.3s ease'
        }}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar — a drawer overlaying the map, which keeps full width behind
          it (before, the hidden sidebar still occupied its flex slot and left
          a dead strip; on phones the map got a ~60px sliver). */}
      <div style={{
        position: 'absolute', top: 0, left: 0, height: '100%',
        width: '400px', maxWidth: '85vw',
        background: '#fff',
        boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
        zIndex: 15,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'transform 0.3s ease',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', color: '#1a1a1a' }}>Ranatrasken</h1>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button 
                onClick={() => setLanguage('nb')}
                style={{ padding: '2px 6px', fontSize: '10px', background: language === 'nb' ? '#333' : '#eee', color: language === 'nb' ? '#fff' : '#333', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>NO</button>
              <button 
                onClick={() => setLanguage('en')}
                style={{ padding: '2px 6px', fontSize: '10px', background: language === 'en' ? '#333' : '#eee', color: language === 'en' ? '#fff' : '#333', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>EN</button>
            </div>
          </div>
          <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#666' }}>
            {language === 'nb' ? '30 utvalgte turer i Rana' : '30 curated hiking trips in Rana'}
          </p>
          
          <UserMenu />

          {session && (
            <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', background: '#f0f0f0', padding: '4px', borderRadius: '8px' }}>
              <button 
                onClick={() => setView('explore')}
                style={{ 
                  flex: 1, padding: '8px', fontSize: '12px', border: 'none', borderRadius: '6px', 
                  background: view === 'explore' ? '#fff' : 'transparent',
                  color: view === 'explore' ? '#333' : '#666',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  fontWeight: view === 'explore' ? 'bold' : 'normal',
                  boxShadow: view === 'explore' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}>
                <List size={14} />
                {language === 'nb' ? 'Utforsk' : 'Explore'}
              </button>
              <button 
                onClick={() => setView('history')}
                style={{ 
                  flex: 1, padding: '8px', fontSize: '12px', border: 'none', borderRadius: '6px', 
                  background: view === 'history' ? '#fff' : 'transparent',
                  color: view === 'history' ? '#333' : '#666',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  fontWeight: view === 'history' ? 'bold' : 'normal',
                  boxShadow: view === 'history' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}>
                <History size={14} />
                {language === 'nb' ? 'Historikk' : 'History'}
              </button>
            </div>
          )}
          
          {view === 'explore' && (
            <>
              {/* Difficulty Filters */}
              <div style={{ marginTop: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#333' }}>
                  {language === 'nb' ? 'Filtrer på vanskelighetsgrad:' : 'Filter by Difficulty:'}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {(Object.keys(difficultyMeta) as DifficultyLevel[]).map((level) => (
                    <button 
                      key={level}
                      onClick={() => setFilterDifficulty(filterDifficulty === level ? null : level)}
                      style={{ 
                        padding: '6px', fontSize: '11px', border: '1px solid #eee', borderRadius: '4px', 
                        background: filterDifficulty === level ? difficultyMeta[level].color : '#f9f9f9',
                        color: filterDifficulty === level ? '#fff' : '#333',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontWeight: filterDifficulty === level ? 'bold' : 'normal'
                      }}>
                      <span style={{ 
                        display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', 
                        background: filterDifficulty === level ? '#fff' : difficultyMeta[level].color,
                        marginRight: '6px'
                      }}></span>
                      {t(difficultyMeta[level].label).split(' ')[0]}
                    </button>
                  ))}
                </div>
                {filterDifficulty && (
                  <div style={{ 
                    marginTop: '10px', padding: '10px', background: '#f0f7ff', borderRadius: '6px', 
                    borderLeft: `4px solid ${difficultyMeta[filterDifficulty].color}`
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0056b3' }}>
                      {t(difficultyMeta[filterDifficulty].label)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#555', marginTop: '3px' }}>
                      {t(difficultyMeta[filterDifficulty].description)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#444', marginTop: '3px', fontStyle: 'italic' }}>
                      {t(difficultyMeta[filterDifficulty].suitability)}
                    </div>
                  </div>
                )}
              </div>

              {/* Age Filters */}
              <div style={{ marginTop: '15px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#333' }}>
                  {language === 'nb' ? 'Barnevennlighet:' : 'Child Suitability:'}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => setFilterAge(6)}
                    style={{ 
                      flex: 1, padding: '6px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px', 
                      background: filterAge === 6 ? '#4caf50' : '#fff',
                      color: filterAge === 6 ? '#fff' : '#333',
                      cursor: 'pointer'
                    }}>{language === 'nb' ? 'Fra 6 år' : 'Ages 6+'}</button>
                  <button 
                    onClick={() => setFilterAge(9)}
                    style={{ 
                      flex: 1, padding: '6px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px', 
                      background: filterAge === 9 ? '#ff9800' : '#fff',
                      color: filterAge === 9 ? '#fff' : '#333',
                      cursor: 'pointer'
                    }}>{language === 'nb' ? 'Fra 9 år' : 'Ages 9+'}</button>
                  <button 
                    onClick={() => setFilterAge(null)}
                    style={{ 
                      flex: 1, padding: '6px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px', 
                      background: filterAge === null ? '#333' : '#fff',
                      color: filterAge === null ? '#fff' : '#333',
                      cursor: 'pointer'
                    }}>{language === 'nb' ? 'Nullstill' : 'Reset'}</button>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', background: '#fcfcfc' }}>
          {view === 'history' ? (
            <ActivityLog onSelect={handleSelectFromHistory} />
          ) : selectedDest ? (
            <div style={{ padding: '10px' }}>
               <button 
                 onClick={() => setSelectedDest(null)}
                 style={{ marginBottom: '15px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}>
                 ← {language === 'nb' ? 'Tilbake til listen' : 'Back to list'}
               </button>
               <h2 style={{ margin: '0 0 10px 0' }}>{selectedDest.name}</h2>
               <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <span style={{ padding: '4px 8px', background: difficultyMeta[selectedDest.difficulty].color, color: '#fff', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                    {t(difficultyMeta[selectedDest.difficulty].label)}
                  </span>
                  <span style={{ fontSize: '12px', color: '#666' }}>{selectedDest.elevation} moh</span>
                  {userStamps.includes(selectedDest.id) && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#28a745', fontSize: '11px', fontWeight: 'bold' }}>
                      <CheckCircle size={14} /> {language === 'nb' ? 'STEMPLET' : 'STAMPED'}
                    </span>
                  )}
               </div>

               {session && !userStamps.includes(selectedDest.id) && (
                 <button 
                   onClick={() => handleStamp(selectedDest.id)}
                   disabled={isStamping}
                   style={{ 
                     width: '100%', padding: '12px', background: '#28a745', color: '#fff', 
                     border: 'none', borderRadius: '8px', cursor: isStamping ? 'not-allowed' : 'pointer',
                     display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                     fontWeight: 'bold', marginBottom: '20px',
                     boxShadow: '0 4px 6px rgba(40,167,69,0.2)'
                   }}
                 >
                   <Award size={18} />
                   {isStamping ? (language === 'nb' ? 'Stempler...' : 'Stamping...') : (language === 'nb' ? 'Stempler tur' : 'Stamp visit')}
                 </button>
               )}
               
               <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>{language === 'nb' ? 'Beskrivelse av turen' : 'Description'}</h3>
                  <p style={{ fontSize: '13px', color: '#444', lineHeight: '1.5', margin: 0 }}>{t(selectedDest.description)}</p>
               </div>

               <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>{language === 'nb' ? 'Hvordan kommer vi oss dit' : 'How to get there'}</h3>
                  <p style={{ fontSize: '13px', color: '#444', lineHeight: '1.5', margin: 0 }}>{t(selectedDest.howToGetThere)}</p>
                  
                  {selectedDest.parking && (
                    <button 
                      onClick={() => {
                        const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedDest.parking!.lat},${selectedDest.parking!.lng}&travelmode=driving`;
                        window.open(url, '_blank');
                      }}
                      style={{ 
                        marginTop: '12px', padding: '8px 12px', fontSize: '12px', background: '#fff', 
                        color: '#007bff', border: '1px solid #007bff', borderRadius: '6px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500'
                      }}
                    >
                      <MapPin size={14} />
                      {language === 'nb' ? 'Åpne veibeskrivelse til parkering' : 'Open driving directions to parking'}
                    </button>
                  )}
               </div>

               {selectedDest.parking && (
                 <div style={{ padding: '12px', background: '#e7f1ff', borderRadius: '8px', border: '1px solid #b8daff' }}>
                    <h3 style={{ fontSize: '13px', margin: '0 0 5px 0', color: '#004085' }}>🅿️ {language === 'nb' ? 'Anbefalt Parkering' : 'Recommended Parking'}</h3>
                    <p style={{ fontSize: '13px', fontWeight: 'bold', margin: '0 0 3px 0' }}>{selectedDest.parking.name}</p>
                    <p style={{ fontSize: '12px', color: '#004085', margin: 0 }}>{t(selectedDest.parking.description)}</p>
                 </div>
               )}
            </div>
          ) : (
            <>
              <div style={{ fontSize: '11px', color: '#999', marginBottom: '10px', padding: '0 5px' }}>
                {language === 'nb' ? `Viser ${filteredDestinations.length} av 30 turer` : `Showing ${filteredDestinations.length} of 30 trips`}
              </div>
              {filteredDestinations.map(dest => (
                <div 
                  key={dest.id}
                  onClick={() => handleFlyTo(dest)}
                  style={{
                    padding: '12px',
                    margin: '5px 0',
                    borderRadius: '6px',
                    border: '1px solid #f0f0f0',
                    background: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = difficultyMeta[dest.difficulty].color;
                    e.currentTarget.style.transform = 'translateX(2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#f0f0f0';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {dest.name}
                      {userStamps.includes(dest.id) && <CheckCircle size={14} color="#28a745" />}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                       {dest.elevation} moh • <span style={{ color: difficultyMeta[dest.difficulty].color, fontWeight: 'bold' }}>{t(difficultyMeta[dest.difficulty].label).split(' ')[0].toUpperCase()}</span>
                    </div>
                  </div>
                  <div style={{ 
                    width: '10px', height: '10px', borderRadius: '50%', 
                    background: difficultyMeta[dest.difficulty].color 
                  }}></div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Map — always full-bleed */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapComponent 
          ref={mapRef} 
          selectedDestination={selectedDest} 
          mapStyle={mapStyle} 
          adminMode={adminMode}
          adminSelectedSegments={adminSegments}
          onRouteSegmentSelect={handleSegmentSelect}
        />
        
        {/* Style Switcher */}
        <div style={{ 
          position: 'absolute', top: '20px', right: '20px', zIndex: 10, 
          display: 'flex', gap: '5px', background: 'rgba(255,255,255,0.9)', 
          padding: '6px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          backdropFilter: 'blur(5px)'
        }}>
          <button 
            onClick={() => setMapStyle('outdoor-v2')}
            style={{ 
              padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '4px', 
              background: mapStyle === 'outdoor-v2' ? '#007bff' : 'transparent', 
              color: mapStyle === 'outdoor-v2' ? '#fff' : '#333', 
              cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s'
            }}>
            Outdoor
          </button>
          <button 
            onClick={() => setMapStyle('hybrid')}
            style={{ 
              padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '4px', 
              background: mapStyle === 'hybrid' ? '#007bff' : 'transparent', 
              color: mapStyle === 'hybrid' ? '#fff' : '#333', 
              cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s'
            }}>
            Satellite
          </button>
          <button 
            onClick={() => setMapStyle('topo-v2')}
            style={{ 
              padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '4px', 
              background: mapStyle === 'topo-v2' ? '#007bff' : 'transparent', 
              color: mapStyle === 'topo-v2' ? '#fff' : '#333', 
              cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s'
            }}>
            Topo
          </button>
        </div>

        {/* Selected-trip card — when the drawer is closed, picking a trip
            still shows the essentials over the map (the pattern the Expo app
            uses). "Se detaljer" reopens the drawer. */}
        {selectedDest && !sidebarOpen && (
          <div style={{
            position: 'absolute', left: '12px', right: '12px', bottom: '16px',
            maxWidth: '420px', margin: '0 auto', zIndex: 10,
            background: 'rgba(255,255,255,0.97)', borderRadius: '12px',
            padding: '12px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                background: difficultyMeta[selectedDest.difficulty].color
              }} />
              <strong style={{
                fontSize: '16px', color: '#1a1a1a', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>{selectedDest.name}</strong>
              {userStamps.includes(selectedDest.id) && <CheckCircle size={16} color="#28a745" />}
              <button
                onClick={() => setSelectedDest(null)}
                aria-label={language === 'nb' ? 'Lukk' : 'Close'}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#888', padding: '4px', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ fontSize: '12px', color: '#555' }}>
              {t(difficultyMeta[selectedDest.difficulty].label)} • {selectedDest.elevation} moh
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                padding: '10px', background: '#007bff', color: '#fff', border: 'none',
                borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer'
              }}>
              {language === 'nb' ? 'Se detaljer' : 'View details'}
            </button>
          </div>
        )}

        {/* Admin Tools Overlay — only visible to admins */}
        {isAdmin && (
          <div style={{ 
            position: 'absolute', bottom: '30px', right: '20px', zIndex: 10, 
            background: 'rgba(0,0,0,0.8)', color: 'white',
            padding: '12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '300px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '14px' }}>Admin Curation</strong>
              <button 
                onClick={() => setAdminMode(!adminMode)}
                style={{ background: adminMode ? '#e31d1d' : '#4caf50', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
              >
                {adminMode ? 'Disable' : 'Enable'}
              </button>
            </div>
            
            {adminMode && (
              <>
                <p style={{ fontSize: '12px', margin: '4px 0', opacity: 0.8 }}>
                  {selectedDest ? `Click red trails on the map to build the route for ${selectedDest.name}.` : 'Select a destination from the sidebar first.'}
                </p>
                
                <div style={{ fontSize: '11px', background: '#333', padding: '6px', borderRadius: '4px' }}>
                  Segments selected: <strong>{adminSegments.length}</strong>
                </div>

                {selectedDest && (
                  <div style={{ display: 'flex', gap: '5px', marginTop: '4px' }}>
                    <button 
                      onClick={handleClearSegments}
                      disabled={adminSegments.length === 0}
                      style={{ flex: 1, padding: '6px', background: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: adminSegments.length === 0 ? 'not-allowed' : 'pointer', fontSize: '11px' }}
                    >
                      Clear
                    </button>
                    <button 
                      onClick={saveAdminRoute}
                      disabled={adminSegments.length === 0 || isSavingRoute}
                      style={{ flex: 2, padding: '6px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: adminSegments.length === 0 || isSavingRoute ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                    >
                      {isSavingRoute ? 'Saving...' : 'Save Route'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
