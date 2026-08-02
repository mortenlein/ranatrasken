import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// Relative imports reach into the web app's source tree; see metro.config.js.
import type { Destination } from '../../../src/data/destinations';
import { routeGeometryFor } from '../../../src/lib/mapStyle';
import { buildMapHtml } from '../lib/map-html';

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY || 'get_your_free_key_at_maptiler_com';

export interface DioramaMapRef {
  showDestination: (dest: Destination | null) => void;
}

interface DioramaMapProps {
  onSelect: (id: number) => void;
}

// The web app's MapLibre diorama, rendered in a WebView (Expo Go has no
// native MapLibre). React Native drives it via window.__cmd(...) and the page
// reports marker taps back via postMessage.
const DioramaMap = forwardRef<DioramaMapRef, DioramaMapProps>(({ onSelect }, ref) => {
  const webRef = useRef<WebView>(null);
  const html = useMemo(() => buildMapHtml(MAPTILER_KEY), []);

  const send = (cmd: object) => {
    webRef.current?.injectJavaScript(`window.__cmd && window.__cmd(${JSON.stringify(cmd)}); true;`);
  };

  useImperativeHandle(ref, () => ({
    showDestination: (dest) => {
      if (dest) {
        send({ type: 'flyTo', center: [dest.lng, dest.lat] });
        send({ type: 'route', geometry: routeGeometryFor(dest) });
      } else {
        send({ type: 'route', geometry: null });
      }
    },
  }));

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'select' && typeof msg.id === 'number') onSelect(msg.id);
    } catch {
      // ignore malformed messages
    }
  };

  return (
    <WebView
      ref={webRef}
      style={styles.map}
      originWhitelist={['*']}
      // The DNT tile CDN only answers CORS for whitelisted origins, and plain
      // http://localhost is on that list — so the page pretends to be it.
      source={{ html, baseUrl: 'http://localhost' }}
      onMessage={handleMessage}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      setSupportMultipleWindows={false}
    />
  );
});

DioramaMap.displayName = 'DioramaMap';

export default DioramaMap;

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: '#1a2332' },
});
