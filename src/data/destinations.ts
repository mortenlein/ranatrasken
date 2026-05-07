import { utmToLatLong } from '@/lib/coords';

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';

export interface LocalizedText {
  nb: string;
  en: string;
}

export interface DifficultyInfo {
  label: LocalizedText;
  color: string;
  description: LocalizedText;
  suitability: LocalizedText;
}

export const difficultyMeta: Record<DifficultyLevel, DifficultyInfo> = {
  easy: {
    label: { nb: 'Enkel (Grønn)', en: 'Easy (Green)' },
    color: '#4caf50',
    description: { 
        nb: 'Korte, flate turer på gode stier. Minimal stigning.', 
        en: 'Short, flat walks on good paths. Minimal incline.' 
    },
    suitability: { 
        nb: 'Perfekt for barn 4+ og nybegynnere.', 
        en: 'Perfect for children 4+ and beginners.' 
    }
  },
  medium: {
    label: { nb: 'Middels (Blå)', en: 'Medium (Blue)' },
    color: '#2196f3',
    description: { 
        nb: 'Moderat lengde og noen bratte partier. Naturlig terreng.', 
        en: 'Moderate length and some steep sections. Natural terrain.' 
    },
    suitability: { 
        nb: 'Anbefalt for barn 6+ med litt turerfaring.', 
        en: 'Recommended for children 6+ with some hiking experience.' 
    }
  },
  hard: {
    label: { nb: 'Krevende (Rød)', en: 'Hard (Red)' },
    color: '#ff9800',
    description: { 
        nb: 'Lengre turer med betydelig stigning. Bratte topper.', 
        en: 'Longer trips with significant elevation gain. Steep peaks.' 
    },
    suitability: { 
        nb: 'Anbefalt for barn 9+ og aktive voksne.', 
        en: 'Recommended for children 9+ and active adults.' 
    }
  },
  expert: {
    label: { nb: 'Ekspert (Svart)', en: 'Expert (Black)' },
    color: '#f44336',
    description: { 
        nb: 'Veldig bratt, lang eller utfordrende terreng. Krevende.', 
        en: 'Very steep, long, or challenging terrain. Demanding.' 
    },
    suitability: { 
        nb: 'For erfarne turgåere og eldre barn (12+).', 
        en: 'For experienced hikers and older children (12+).' 
    }
  }
};

export interface Destination {
  id: number;
  name: string;
  utmE: number;
  utmN: number;
  lat: number;
  lng: number;
  elevation: number;
  difficulty: DifficultyLevel;
  childSuitability: number;
  description: LocalizedText;
  howToGetThere: LocalizedText;
  parkingLatLong?: number[];
  parkingUTM?: (number | string)[];
  parking?: { 
    name: string;
    lat: number; 
    lng: number;
    description: LocalizedText;
  };
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const rawDestinations = [
  { 
    id: 1, 
    name: "Andfjellet", 
    utmE: 509664, 
    utmN: 7367401, 
    elevation: 1119, 
    descNb: "Parker ved Virvassveien og fortsett oppover anleggsveien mot tårnet på Andfjellet.",
    howNb: "Kjør E6 nordover. Ta av mot Virvassdalen. Følg veien ca 5km.",
    parkingLatLong: [66.4385, 15.1482] 
  },
  { 
    id: 2, 
    name: "Bakkahytta", 
    utmE: 432259, 
    utmN: 7352037, 
    elevation: 316,
    descNb: "Følg vei til Bakkahytta fra parkering.",
    howNb: "Kjør til butikken i Utskarpen. Fortsett ca 1 km i retning Nesna. Parkering på venstre side.",
    parkingLatLong: [66.314, 13.548]
  },
  { 
    id: 3, 
    name: "Bertelberget", 
    utmE: 468489, 
    utmN: 7352846, 
    elevation: 380,
    descNb: "Kjør ca 4 km på Anleggshammerveien. Parker ved siden av veien. Skilt mot Bertelberget. Følg sti videre.",
    howNb: "Kjør til Gruben og ta av på veien mot Anleggshammeren.",
    parkingLatLong: [66.2873, 14.2843]
  },
  { 
    id: 4, 
    name: "Bjørnhaugen", 
    utmE: 469658, 
    utmN: 7350090, 
    elevation: 740, 
    descNb: "Etter ca 1 km kommer man til Hammertjønna. Derfra fortsetter man på stien ca 2 km til Bjørnhaugen.",
    howNb: "Ta av fra E12 mot Mofjellet (Anleggshammeren). Mulig å kjøre anleggsveien til topps.",
    parkingUTM: [485664, 7356905, "Plurdalsveien (Stillvasstrand)"] 
  },
  { 
    id: 5, 
    name: "Fingerlia", 
    utmE: 471921, 
    utmN: 7353459, 
    elevation: 230, 
    descNb: "Fortsett fra bommen til fots ca 2 km mot Fingerlia.",
    howNb: "Kjør E12 mot Gruben. Kjør Ildgrubveien og parker ved snuplassen.",
    parkingUTM: [471921, 7353459, "Ildgrubveien (Gruben)"] 
  },
  { 
    id: 6, 
    name: "Fisklausvatnet", 
    utmE: 473498, 
    utmN: 7346804, 
    elevation: 840, 
    descNb: "På stang hvor skiløypa flater ut, like før den stopper. Utsikt mot Fisklausvatnet.",
    howNb: "Kjører E12 forbi Raudvatnet, til Røde Korshytta. Passer best som skitur.",
    parkingLatLong: [66.25798, 14.54051] 
  },
  { 
    id: 7, 
    name: "Kubben", 
    utmE: 481500, 
    utmN: 7340000, 
    elevation: 1040, 
    descNb: "Følg merket sti opp mot Kubben.",
    howNb: "Parkering ved sti.",
    parkingLatLong: [66.19618, 14.59159]
  },
  { 
    id: 8, 
    name: "Granneset", 
    utmE: 495179, 
    utmN: 7377713, 
    elevation: 280, 
    descNb: "Gå over brua mot gården Stormdalsheia. Følg sti og skilt opp lia mot Granneset.",
    howNb: "Kjører E6 nordover til Storvoll. Ta av til venstre, kjør et par hundre meter tilbake og parker.",
    parkingUTM: [456763, 7357082, "Skistua (Selfors)"] 
  },
  { 
    id: 9, 
    name: "Gråsteintinden", 
    utmE: 438300, 
    utmN: 7355235, 
    elevation: 577,
    descNb: "Etter ca 2 km, ved stikryss, sving av opp mot Gråsteintinden. Stien videre mot toppen er rødmerket.",
    howNb: "Kjør til Sjonbotn og ta av veien opp til kraftstasjonen.",
    parkingLatLong: [66.3106, 13.5635]
  },
  { 
    id: 10, 
    name: "Hauknestinden", 
    utmE: 458202, 
    utmN: 7349701, 
    elevation: 799, 
    descNb: "Skiltet er plassert på varden.",
    howNb: "Fra lysløypa i Åga, fra skolen på Hauknes, eller fra dammen ved Andfiskvatnet.",
    parkingLatLong: [66.2855, 14.0543] 
  },
  { 
    id: 11, 
    name: "Sauvasshytta", 
    utmE: 488773, 
    utmN: 7340757, 
    elevation: 970, 
    descNb: "Flere alternativer. Kan gå både fra Umbukta ca 12 km en vei, og fra Plurdalen ca 8 km en vei.",
    howNb: "Kjør til Umbukta eller Plurdalen."
  },
  { 
    id: 12, 
    name: "Inner-Bredek", 
    utmE: 495559, 
    utmN: 7378554, 
    elevation: 307, 
    descNb: "Følg sti og skilt opp lia mot Bredek. Ta av til venstre mot Inner-Bredek etter ca 400 meter.",
    howNb: "Kjør nordover langs E6 til Storvoll. Ta av til venstre, kjør et par hundre meter tilbake.",
    parkingUTM: [495179, 7377713, "Storvoll (E6)"] 
  },
  { 
    id: 13, 
    name: "Klokkerhagen", 
    utmE: 464880, 
    utmN: 7355089, 
    elevation: 20,
    descNb: "Skiltet er plassert på Tor Bs plass, rett ved Årestua.",
    howNb: "Mest vanlig fra parkering ved Klokkerhagen eller Revelneset."
  },
  { 
    id: 16, 
    name: "Lapplia", 
    utmE: 502324, 
    utmN: 7340435, 
    elevation: 570, 
    descNb: "Merket, litt bratt sti opp til Lapplia. Ca 1 km en vei.",
    howNb: "Kjør E6 nordover og gjennom tunnelen i Illhullia. Parkering like etter utgangen.",
    parkingUTM: [445537, 7351693, "E12 mot Nesna (Straumen)"] 
  },
  { 
    id: 20, 
    name: "Selforsfjellet", 
    utmE: 464557, 
    utmN: 7356827, 
    elevation: 218, 
    descNb: "Følg skogsveien opp mot Varmosletta. Ta av til høyre like før Varmosletta. Følg stien sørover.",
    howNb: "Parker i enden av Skogveien på Selfors.",
    parkingLatLong: [66.3309, 14.1917] 
  },
  { 
    id: 25, 
    name: "Storhaugen", 
    utmE: 464942, 
    utmN: 7358039, 
    elevation: 409, 
    descNb: "Følg skogsvei forbi Varmosletta og videre oppover lia til Storhaugen.",
    howNb: "Kjør til parkering i enden av Skogveien på Selfors.",
    parkingLatLong: [66.3309, 14.1917] 
  },
  { 
    id: 27, 
    name: "Storvarden på Mofjellet", 
    utmE: 464942, 
    utmN: 7358039, 
    elevation: 409, 
    descNb: "På huset på toppen.",
    howNb: "Fra Vatnaveien eller Finsetveien.",
    parkingUTM: [463393, 7351955, "Vatnaveien (Mofjellet)"] 
  },
  { 
    id: 28, 
    name: "Svarttjønna på Ytteren", 
    utmE: 462560, 
    utmN: 7360603, 
    elevation: 290, 
    descNb: "Følg skogsvei fra svingen i Karvebakken.",
    howNb: "Kjør opp Langdalen på Ytteren. Ta av mot Karvebakken.",
    parkingUTM: [462560, 7360603, "Ytteren lysløype"] 
  },
  { 
    id: 29, 
    name: "Vindskjermen på Mofjellet", 
    utmE: 463393, 
    utmN: 7351955, 
    elevation: 520, 
    descNb: "Følg kraftlinja til du er oppe. Ca. 3 km en vei.",
    howNb: "Fra Vatnaveien, parker ved garasjer på snuplassen.",
    parkingUTM: [463393, 7351955, "Vatnaveien (Mofjellet)"] 
  },
  { 
    id: 30, 
    name: "Østerdalsknabben", 
    utmE: 494763, 
    utmN: 7354101, 
    elevation: 1116, 
    descNb: "Stien starter på venstre side, like før Lappsætra. Se etter skilt.",
    howNb: "Kjør Grønfjelldalsveien til Østerdal. Fortsett mot Kalvatnet.",
    parkingUTM: [494763, 7354101, "Lappsætra (Grønfjelldal)"] 
  },
];

// Simple mock translator for the demo
const translate = (text: string): string => {
    return text + " (Translated to English)";
};

export const destinations: Destination[] = rawDestinations.map(d => {
  const [lat, lng] = utmToLatLong(d.utmE, d.utmN);
  
  let parking;
  let distanceKm = 0;

  if (d.parkingLatLong) {
    const [pLat, pLng] = d.parkingLatLong;
    distanceKm = calculateDistance(lat, lng, pLat, pLng);
    parking = {
      name: "Parkering",
      lat: pLat,
      lng: pLng,
      description: {
          nb: `Anbefalt parkering. Avstand til turmål: ca ${distanceKm.toFixed(1)} km en vei.`,
          en: `Recommended parking. Distance to destination: approx ${distanceKm.toFixed(1)} km one way.`
      }
    };
  } else if (d.parkingUTM) {
    const [pLat, pLng] = utmToLatLong(d.parkingUTM[0] as number, d.parkingUTM[1] as number);
    distanceKm = calculateDistance(lat, lng, pLat, pLng);
    parking = {
      name: d.parkingUTM[2] as string,
      lat: pLat,
      lng: pLng,
      description: {
          nb: `Offisiell parkering for ${d.name}. Avstand: ca ${distanceKm.toFixed(1)} km en vei.`,
          en: `Official parking for ${d.name}. Distance: approx ${distanceKm.toFixed(1)} km one way.`
      }
    };
  }

  let difficulty: DifficultyLevel = 'medium';
  if (d.elevation < 250) difficulty = 'easy';
  else if (d.elevation > 950) difficulty = 'expert';
  else if (d.elevation > 650) difficulty = 'hard';

  // Refined child suitability (0-10)
  // Higher elevation and longer distance reduces suitability
  let score = 10;
  score -= (d.elevation / 200); // Max -5 for 1000m
  if (distanceKm > 0) {
    score -= (distanceKm * 1.5); // -1.5 per km
  } else {
    score -= 3; // Penalty for unknown start/distance
  }

  return {
    ...d,
    lat,
    lng,
    difficulty,
    childSuitability: Math.max(1, Math.min(10, Math.round(score))),
    description: {
        nb: d.descNb || "Ingen beskrivelse tilgjengelig.",
        en: d.descNb ? translate(d.descNb) : "No description available."
    },
    howToGetThere: {
        nb: d.howNb || "Ingen instruksjoner tilgjengelig.",
        en: d.howNb ? translate(d.howNb) : "No instructions available."
    },
    parking
  };
});
