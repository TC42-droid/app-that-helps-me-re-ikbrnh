import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

export interface MapMarker {
    id: string;
    latitude: number;
    longitude: number;
    title?: string;
    description?: string;
}

interface MapProps {
    markers?: MapMarker[];
    initialRegion?: {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
    };
    style?: ViewStyle;
    showsUserLocation?: boolean;
}

function injectLeafletCSS() {
    const id = 'leaflet-css';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
}

function loadLeafletScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if ((window as any).L) {
            resolve();
            return;
        }
        const id = 'leaflet-js';
        if (document.getElementById(id)) {
            // Script tag exists but L not ready yet — wait for it
            const existing = document.getElementById(id) as HTMLScriptElement;
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', reject);
            return;
        }
        const script = document.createElement('script');
        script.id = id;
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

export const Map = ({
    markers = [],
    initialRegion = {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
    },
    style,
    showsUserLocation = false,
}: MapProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);

    useEffect(() => {
        let cancelled = false;

        async function initMap() {
            injectLeafletCSS();
            await loadLeafletScript();
            if (cancelled || !containerRef.current) return;

            const L = (window as any).L;

            // Destroy previous instance if re-mounting
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }

            console.log('[Map] Initializing Leaflet map', { lat: initialRegion.latitude, lng: initialRegion.longitude });
            const map = L.map(containerRef.current).setView(
                [initialRegion.latitude, initialRegion.longitude],
                13
            );
            mapRef.current = map;

            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            }).addTo(map);

            // Fix default icon paths (Leaflet asset resolution breaks in bundlers)
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });

            markers.forEach((m) => {
                const marker = L.marker([m.latitude, m.longitude]).addTo(map);
                if (m.title || m.description) {
                    const popupContent = [m.title, m.description].filter(Boolean).join('<br/>');
                    marker.bindPopup(popupContent);
                }
            });

            if (showsUserLocation && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        if (cancelled || !mapRef.current) return;
                        const { latitude, longitude } = pos.coords;
                        console.log('[Map] User location obtained', { latitude, longitude });
                        const userMarker = L.circleMarker([latitude, longitude], {
                            radius: 8,
                            fillColor: '#4285F4',
                            color: '#fff',
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 0.9,
                        }).addTo(map);
                        userMarker.bindPopup('You are here');
                        map.setView([latitude, longitude], 15);
                    },
                    (err) => {
                        console.warn('[Map] Geolocation error', err.message);
                    }
                );
            }
        }

        initMap().catch((err) => console.error('[Map] Failed to initialize Leaflet map', err));

        return () => {
            cancelled = true;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialRegion.latitude, initialRegion.longitude, showsUserLocation]);

    // Update markers when they change without re-creating the map
    useEffect(() => {
        const L = (window as any).L;
        const map = mapRef.current;
        if (!L || !map) return;

        // Remove existing marker layers (not tile layers)
        map.eachLayer((layer: any) => {
            if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                map.removeLayer(layer);
            }
        });

        markers.forEach((m) => {
            const marker = L.marker([m.latitude, m.longitude]).addTo(map);
            if (m.title || m.description) {
                const popupContent = [m.title, m.description].filter(Boolean).join('<br/>');
                marker.bindPopup(popupContent);
            }
        });
    }, [markers]);

    return (
        <View style={[styles.container, style]}>
            <div ref={containerRef} style={{ height: '100%', width: '100%', minHeight: 200 }} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
        borderRadius: 12,
        width: '100%',
        minHeight: 200,
        backgroundColor: '#e5e7eb',
    },
});
