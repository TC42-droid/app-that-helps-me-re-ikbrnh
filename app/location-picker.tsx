import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  Alert,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useColorScheme } from 'react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { MapPin, Navigation, CheckCircle, Minus, Plus } from 'lucide-react-native';
import { COLORS, DARK_COLORS } from '@/styles/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { saveWorkLocation, getWorkLocation, WorkLocation } from '@/utils/workLocation';

const DEFAULT_LAT = 37.78825;
const DEFAULT_LNG = -122.4324;
const MIN_RADIUS = 50;
const MAX_RADIUS = 500;
const RADIUS_STEP = 10;

export default function LocationPickerScreen() {
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? DARK_COLORS : COLORS;
  const { height } = useWindowDimensions();

  const [pinLat, setPinLat] = useState(DEFAULT_LAT);
  const [pinLng, setPinLng] = useState(DEFAULT_LNG);
  const [radius, setRadius] = useState(150);
  const [label, setLabel] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [sliderWidth, setSliderWidth] = useState(0);

  const webViewRef = useRef<WebView>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinLatRef = useRef(DEFAULT_LAT);
  const pinLngRef = useRef(DEFAULT_LNG);

  // Keep refs in sync for use inside callbacks
  useEffect(() => { pinLatRef.current = pinLat; }, [pinLat]);
  useEffect(() => { pinLngRef.current = pinLng; }, [pinLng]);

  // Load existing saved location on mount
  useEffect(() => {
    const loadExisting = async () => {
      const existing = await getWorkLocation();
      if (existing) {
        console.log('[LocationPicker] Loaded existing work location:', existing);
        setPinLat(existing.latitude);
        setPinLng(existing.longitude);
        pinLatRef.current = existing.latitude;
        pinLngRef.current = existing.longitude;
        setRadius(existing.radius);
        setLabel(existing.label);
      } else {
        await locateUser(false);
      }
    };
    loadExisting();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (Platform.OS === 'web') {
      setLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      return;
    }
    setIsGeocoding(true);
    try {
      console.log('[LocationPicker] Reverse geocoding:', lat, lng);
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results && results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.street, r.city, r.region].filter(Boolean);
        const addr = parts.join(', ');
        setLabel(addr || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        console.log('[LocationPicker] Geocoded address:', addr);
      } else {
        setLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch (e) {
      console.error('[LocationPicker] Reverse geocode error:', e);
      setLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  const scheduleGeocode = useCallback((lat: number, lng: number) => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(() => {
      reverseGeocode(lat, lng);
    }, 600);
  }, [reverseGeocode]);

  const sendMapCommand = useCallback((cmd: object) => {
    const js = `window.handleCommand(${JSON.stringify(cmd)}); true;`;
    webViewRef.current?.injectJavaScript(js);
  }, []);

  const locateUser = useCallback(async (showAlert = true) => {
    if (Platform.OS === 'web') return;
    setIsLocating(true);
    console.log('[LocationPicker] User pressed locate me button');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (showAlert) Alert.alert('Permission needed', 'Location permission is required to use this feature.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      console.log('[LocationPicker] Got current position:', latitude, longitude);
      setPinLat(latitude);
      setPinLng(longitude);
      pinLatRef.current = latitude;
      pinLngRef.current = longitude;
      sendMapCommand({ type: 'movePin', lat: latitude, lng: longitude });
      scheduleGeocode(latitude, longitude);
    } catch (e) {
      console.error('[LocationPicker] Get current position error:', e);
    } finally {
      setIsLocating(false);
    }
  }, [scheduleGeocode, sendMapCommand]);

  const handleMapMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'pinMoved') {
        console.log('[LocationPicker] Pin moved to:', msg.lat, msg.lng);
        setPinLat(msg.lat);
        setPinLng(msg.lng);
        pinLatRef.current = msg.lat;
        pinLngRef.current = msg.lng;
        scheduleGeocode(msg.lat, msg.lng);
      } else if (msg.type === 'mapReady') {
        console.log('[LocationPicker] Map ready');
        setMapReady(true);
      }
    } catch {
      // ignore parse errors
    }
  }, [scheduleGeocode]);

  // When map becomes ready, send initial pin position
  useEffect(() => {
    if (mapReady) {
      sendMapCommand({ type: 'movePin', lat: pinLatRef.current, lng: pinLngRef.current });
      reverseGeocode(pinLatRef.current, pinLngRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  const handleSave = async () => {
    console.log('[LocationPicker] User pressed Set Work Location button');
    setIsSaving(true);
    try {
      const loc: WorkLocation = {
        latitude: pinLat,
        longitude: pinLng,
        radius,
        label: label || `${pinLat.toFixed(5)}, ${pinLng.toFixed(5)}`,
      };
      await saveWorkLocation(loc);
      console.log('[LocationPicker] Work location saved, navigating back');
      router.back();
    } catch (e) {
      console.error('[LocationPicker] Save error:', e);
      Alert.alert('Error', 'Could not save work location. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const adjustRadius = (delta: number) => {
    const next = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, radius + delta));
    console.log('[LocationPicker] Radius adjusted to:', next);
    setRadius(next);
  };

  // Custom slider pan responder
  const sliderPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        if (sliderWidth <= 0) return;
        const x = e.nativeEvent.locationX;
        const ratio = Math.max(0, Math.min(1, x / sliderWidth));
        const raw = MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS);
        const snapped = Math.round(raw / RADIUS_STEP) * RADIUS_STEP;
        console.log('[LocationPicker] Radius slider tapped to:', snapped);
        setRadius(snapped);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        if (sliderWidth <= 0) return;
        const x = e.nativeEvent.locationX;
        const ratio = Math.max(0, Math.min(1, x / sliderWidth));
        const raw = MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS);
        const snapped = Math.round(raw / RADIUS_STEP) * RADIUS_STEP;
        setRadius(snapped);
      },
    })
  ).current;

  const mapHtml = buildMapHtml(pinLat, pinLng, colorScheme === 'dark');
  const mapHeight = Math.round(height * 0.52);
  const radiusDisplay = radius >= 1000 ? `${(radius / 1000).toFixed(1)}km` : `${radius}m`;
  const sliderFill = (radius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Set Work Location',
          headerShown: true,
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <View style={[styles.container, { backgroundColor: C.background }]}>
        {/* Map */}
        <View style={[styles.mapWrapper, { height: mapHeight }]}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            style={styles.webview}
            scrollEnabled={false}
            onMessage={handleMapMessage}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.mapLoading}>
                <ActivityIndicator color={C.primary} />
              </View>
            )}
          />
          {/* Locate me button */}
          <AnimatedPressable
            onPress={() => locateUser(true)}
            style={[styles.locateBtn, { backgroundColor: C.surface }]}
            accessibilityLabel="Use my current location"
          >
            {isLocating
              ? <ActivityIndicator size="small" color={C.primary} />
              : <Navigation size={20} color={C.primary} />
            }
          </AnimatedPressable>
        </View>

        {/* Bottom panel */}
        <View style={[styles.panel, { backgroundColor: C.surface, borderColor: C.border }]}>
          {/* Address label */}
          <View style={styles.addressRow}>
            <MapPin size={18} color={C.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              {isGeocoding ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color={C.textSecondary} />
                  <Text style={[styles.addressText, { color: C.textSecondary }]}>
                    Finding address...
                  </Text>
                </View>
              ) : (
                <Text
                  style={[styles.addressText, { color: label ? C.text : C.textTertiary }]}
                  numberOfLines={2}
                >
                  {label || 'Tap the map to place your work location'}
                </Text>
              )}
            </View>
          </View>

          {/* Radius control */}
          <View style={styles.sliderSection}>
            <View style={styles.sliderHeader}>
              <Text style={[styles.sliderLabel, { color: C.text }]}>
                Geofence radius
              </Text>
              <View style={[styles.radiusBadge, { backgroundColor: C.primaryMuted }]}>
                <Text style={[styles.radiusBadgeText, { color: C.primary }]}>
                  {radiusDisplay}
                </Text>
              </View>
            </View>

            {/* Custom slider track */}
            <View
              style={styles.sliderTrackWrapper}
              onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
              {...sliderPanResponder.panHandlers}
            >
              <View style={[styles.sliderTrack, { backgroundColor: C.surfaceSecondary }]}>
                <View
                  style={[
                    styles.sliderFill,
                    { backgroundColor: C.primary, width: `${sliderFill * 100}%` },
                  ]}
                />
                <View
                  style={[
                    styles.sliderThumb,
                    {
                      backgroundColor: C.primary,
                      left: `${sliderFill * 100}%`,
                      borderColor: C.surface,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.sliderTicks}>
              <Text style={[styles.sliderTick, { color: C.textTertiary }]}>50m</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <AnimatedPressable
                  onPress={() => adjustRadius(-RADIUS_STEP)}
                  style={[styles.stepBtn, { backgroundColor: C.surfaceSecondary }]}
                  accessibilityLabel="Decrease radius"
                >
                  <Minus size={14} color={C.text} />
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => adjustRadius(RADIUS_STEP)}
                  style={[styles.stepBtn, { backgroundColor: C.surfaceSecondary }]}
                  accessibilityLabel="Increase radius"
                >
                  <Plus size={14} color={C.text} />
                </AnimatedPressable>
              </View>
              <Text style={[styles.sliderTick, { color: C.textTertiary }]}>500m</Text>
            </View>
          </View>

          {/* Save button */}
          <AnimatedPressable
            onPress={handleSave}
            disabled={isSaving}
            style={[
              styles.saveBtn,
              { backgroundColor: C.primary },
              isSaving && { opacity: 0.6 },
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <CheckCircle size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Set Work Location</Text>
              </>
            )}
          </AnimatedPressable>
        </View>
      </View>
    </>
  );
}

function buildMapHtml(initLat: number, initLng: number, dark: boolean): string {
  const bg = dark ? '#1C1F26' : '#F7F8FA';
  const pinColor = '#2563EB';
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${bg}; }
    #map { height: 100vh; width: 100vw; }
    .custom-pin {
      width: 32px; height: 32px;
      background: ${pinColor};
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .pin-wrapper { width: 32px; height: 32px; transform: rotate(45deg); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${initLat}, ${initLng}], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var pinIcon = L.divIcon({
      className: '',
      html: '<div class="pin-wrapper"><div class="custom-pin"></div></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    var marker = L.marker([${initLat}, ${initLng}], {
      icon: pinIcon,
      draggable: true,
    }).addTo(map);

    marker.on('dragend', function(e) {
      var pos = e.target.getLatLng();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'pinMoved', lat: pos.lat, lng: pos.lng,
      }));
    });

    map.on('click', function(e) {
      marker.setLatLng(e.latlng);
      map.panTo(e.latlng);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'pinMoved', lat: e.latlng.lat, lng: e.latlng.lng,
      }));
    });

    window.handleCommand = function(cmd) {
      if (cmd.type === 'movePin') {
        var latlng = L.latLng(cmd.lat, cmd.lng);
        marker.setLatLng(latlng);
        map.setView(latlng, 15);
      }
    };

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapWrapper: {
    width: '100%',
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  mapLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locateBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  panel: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderTopWidth: 1,
    gap: 20,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'SpaceGrotesk-Regular',
  },
  sliderSection: {
    gap: 8,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'SpaceGrotesk-SemiBold',
  },
  radiusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  radiusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'SpaceGrotesk-SemiBold',
  },
  sliderTrackWrapper: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    position: 'relative',
    overflow: 'visible',
  },
  sliderFill: {
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  sliderThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    position: 'absolute',
    top: -8,
    marginLeft: -11,
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderTicks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderTick: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk-Regular',
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'SpaceGrotesk-Bold',
    letterSpacing: -0.2,
  },
});
