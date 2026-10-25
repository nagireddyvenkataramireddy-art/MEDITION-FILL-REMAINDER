import express from 'express';
import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const PORT = Number(process.env.PORT) || 3000;
const VAPID_FILE = path.resolve(process.cwd(), '.vapid-keys.json');

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

function getOrCreateVapidKeys(): VapidKeys {
  try {
    if (fs.existsSync(VAPID_FILE)) {
      const raw = fs.readFileSync(VAPID_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.publicKey && parsed.privateKey) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read existing VAPID keys, generating new ones.');
  }

  const keys = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Could not persist VAPID keys to disk:', e);
  }
  return keys;
}

const vapidKeys = getOrCreateVapidKeys();
webpush.setVapidDetails(
  'mailto:reminders@medimind.app',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

interface ScheduledDose {
  id: string;
  medicationId: string;
  name: string;
  dosage: string;
  instruction?: string;
  time: string;
  targetTimestamp: number;
  sound?: string;
  fired?: boolean;
}

interface ClientScheduleRecord {
  subscription: webpush.PushSubscription;
  doses: ScheduledDose[];
  updatedAt: number;
}

// Store subscriptions and their scheduled doses keyed by subscription endpoint
const clientSchedules = new Map<string, ClientScheduleRecord>();
const firedAlarmIds = new Set<string>();

// Send high-priority Web Push notification to wake up Android/iOS Service Worker even when app is closed or screen is locked
async function sendWebPush(subscription: webpush.PushSubscription, payload: Record<string, any>) {
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      {
        TTL: 3600,
        urgency: 'high',
      }
    );
    return true;
  } catch (err: any) {
    console.warn('WebPush delivery error:', err?.statusCode || err?.message);
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      clientSchedules.delete(subscription.endpoint);
    }
    return false;
  }
}

// Background server ticker every 3 seconds to fire due medication reminders via Web Push
setInterval(() => {
  const now = Date.now();
  clientSchedules.forEach((record) => {
    record.doses.forEach((dose) => {
      if (dose.fired || firedAlarmIds.has(dose.id)) return;
      // Fire when targetTimestamp is reached (within a 10 minute window)
      if (now >= dose.targetTimestamp && now - dose.targetTimestamp < 10 * 60 * 1000) {
        dose.fired = true;
        firedAlarmIds.add(dose.id);
        sendWebPush(record.subscription, {
          type: 'MEDICATION_REMINDER',
          id: dose.id,
          medicationId: dose.medicationId,
          name: dose.name,
          dosage: dose.dosage || '1 dose',
          instruction: dose.instruction || '',
          time: dose.time,
          sound: dose.sound || 'alert',
          title: `⏰ Time for ${dose.name} (${dose.time})`,
          body: `Scheduled dose: ${dose.dosage || '1 dose'}. Tap Taken to record.`
        });
      }
    });
  });
}, 3000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // 1. Return VAPID public key for client PushManager subscription
  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  // 2. Sync client push subscription & medication schedule
  app.post('/api/push/sync-schedule', (req, res) => {
    const { subscription, doses } = req.body || {};
    if (!subscription || !subscription.endpoint) {
      res.status(400).json({ error: 'Missing push subscription' });
      return;
    }

    const validDoses: ScheduledDose[] = Array.isArray(doses)
      ? doses.map((d: any) => ({
          ...d,
          fired: firedAlarmIds.has(d.id),
        }))
      : [];

    clientSchedules.set(subscription.endpoint, {
      subscription,
      doses: validDoses,
      updatedAt: Date.now(),
    });

    res.json({ ok: true, scheduledCount: validDoses.length });
  });

  // 3. Trigger immediate or delayed Web Push test notification (works when app is closed / phone locked)
  app.post('/api/push/test', async (req, res) => {
    const { subscription, delaySeconds = 0, sound = 'alert' } = req.body || {};
    if (!subscription || !subscription.endpoint) {
      res.status(400).json({ error: 'Missing push subscription' });
      return;
    }

    const delayMs = Math.max(0, Math.min(120, Number(delaySeconds) || 0)) * 1000;
    const payload = {
      type: 'MEDICATION_REMINDER',
      id: `test-${Date.now()}`,
      medicationId: 'test',
      name: 'Pill Reminder Test',
      dosage: '1 pill',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sound,
      title: '⏰ Pill Reminder Alert!',
      body: delayMs > 0
        ? 'Lock-screen & closed-app push reminder is working on your phone!'
        : 'Phone push reminders are active with sound & vibration!'
    };

    if (delayMs > 0) {
      setTimeout(() => {
        sendWebPush(subscription, payload);
      }, delayMs);
      res.json({ ok: true, scheduledInSeconds: delaySeconds });
    } else {
      const sent = await sendWebPush(subscription, payload);
      res.json({ ok: sent });
    }
  });

  // 4. Server-side Nearby Medical Stores / Hospitals search (Overpass + Nominatim + Gemini Maps Grounding)
  app.post('/api/places/nearby', async (req, res) => {
    const { lat, lng, type = 'pharmacy', queryText = '' } = req.body || {};
    const searchType = type === 'hospital' ? 'hospital' : 'pharmacy';

    try {
      let targetLat = typeof lat === 'number' && !isNaN(lat) ? lat : null;
      let targetLng = typeof lng === 'number' && !isNaN(lng) ? lng : null;

      // If user typed a city/area/pincode query, geocode it via Nominatim first
      if (queryText && String(queryText).trim().length > 0) {
        try {
          const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(String(queryText).trim())}`;
          const geoRes = await fetch(geoUrl, {
            headers: { 'User-Agent': 'MediMindHealthApp/1.0' }
          });
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (Array.isArray(geoData) && geoData.length > 0) {
              targetLat = parseFloat(geoData[0].lat);
              targetLng = parseFloat(geoData[0].lon);
            }
          }
        } catch (geoErr) {
          console.warn('Server geocoding warning:', geoErr);
        }
      }

      if (targetLat === null || targetLng === null) {
        res.status(400).json({ error: 'Location coordinates or area name required', places: [] });
        return;
      }

      const places: Array<{
        title: string;
        uri: string;
        address?: string;
        distanceKm?: number;
        phone?: string;
        lat?: number;
        lng?: number;
      }> = [];

      // Helper to calculate Haversine distance in km
      const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
      };

      // A. Query OpenStreetMap Overpass API for real verified pharmacies/medical stores or hospitals within 10km
      try {
        const radiusMeters = 10000;
        const overpassFilter =
          searchType === 'pharmacy'
            ? `node["amenity"="pharmacy"](around:${radiusMeters},${targetLat},${targetLng});
               way["amenity"="pharmacy"](around:${radiusMeters},${targetLat},${targetLng});
               node["shop"="chemist"](around:${radiusMeters},${targetLat},${targetLng});
               node["healthcare"="pharmacy"](around:${radiusMeters},${targetLat},${targetLng});`
            : `node["amenity"="hospital"](around:${radiusMeters},${targetLat},${targetLng});
               way["amenity"="hospital"](around:${radiusMeters},${targetLat},${targetLng});
               node["amenity"="clinic"](around:${radiusMeters},${targetLat},${targetLng});
               node["healthcare"="hospital"](around:${radiusMeters},${targetLat},${targetLng});`;

        const overpassQuery = `[out:json][timeout:10];(${overpassFilter});out center 25;`;
        const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'MediMindHealthApp/1.0' },
          body: `data=${encodeURIComponent(overpassQuery)}`,
        });

        if (overpassRes.ok) {
          const overpassData = await overpassRes.json();
          const elements = overpassData?.elements || [];
          for (const el of elements) {
            const name = el.tags?.name || el.tags?.['name:en'];
            if (!name) continue;
            const elLat = el.lat ?? el.center?.lat;
            const elLng = el.lon ?? el.center?.lon;
            if (typeof elLat !== 'number' || typeof elLng !== 'number') continue;

            const dist = getDistanceKm(targetLat, targetLng, elLat, elLng);
            const street = [
              el.tags?.['addr:housenumber'],
              el.tags?.['addr:street'],
              el.tags?.['addr:suburb'] || el.tags?.['addr:city']
            ].filter(Boolean).join(', ');

            const mapsUri = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${street}`.trim())}&query_place_id=${elLat},${elLng}`;
            const dirUri = `https://www.google.com/maps/dir/?api=1&destination=${elLat},${elLng}`;

            places.push({
              title: name,
              uri: dirUri || mapsUri,
              address: street || `${dist} km from your location`,
              distanceKm: dist,
              phone: el.tags?.phone || el.tags?.['contact:phone'],
              lat: elLat,
              lng: elLng
            });
          }
        }
      } catch (overpassErr) {
        console.warn('Overpass lookup warning:', overpassErr);
      }

      // B. If Overpass returned fewer than 3 places, also check Nominatim nearby search
      if (places.length < 3) {
        try {
          const delta = 0.09; // ~10km bounding box
          const viewbox = `${targetLng - delta},${targetLat + delta},${targetLng + delta},${targetLat - delta}`;
          const nomQuery = searchType === 'pharmacy' ? 'pharmacy' : 'hospital';
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${nomQuery}&bounded=1&viewbox=${viewbox}&limit=15`;
          const nomRes = await fetch(nomUrl, {
            headers: { 'User-Agent': 'MediMindHealthApp/1.0' }
          });
          if (nomRes.ok) {
            const nomData = await nomRes.json();
            if (Array.isArray(nomData)) {
              for (const item of nomData) {
                const elLat = parseFloat(item.lat);
                const elLng = parseFloat(item.lon);
                const rawName = (item.display_name || '').split(',')[0]?.trim() || (searchType === 'pharmacy' ? 'Medical Store' : 'Hospital');
                const addressParts = (item.display_name || '').split(',').slice(1, 4).join(',').trim();
                const dist = getDistanceKm(targetLat, targetLng, elLat, elLng);
                if (!places.some(p => p.title.toLowerCase() === rawName.toLowerCase())) {
                  places.push({
                    title: rawName,
                    uri: `https://www.google.com/maps/dir/?api=1&destination=${elLat},${elLng}`,
                    address: addressParts || `${dist} km away`,
                    distanceKm: dist,
                    lat: elLat,
                    lng: elLng
                  });
                }
              }
            }
          }
        } catch (nomErr) {
          console.warn('Nominatim nearby fallback warning:', nomErr);
        }
      }

      // C. Also enrich with Gemini Google Maps Grounding if GEMINI_API_KEY is available
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (apiKey && places.length < 5) {
        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
          });
          const query = `Find all nearby ${searchType === 'pharmacy' ? 'pharmacies and medical stores' : 'hospitals and clinics'} within 10 kilometers of latitude ${targetLat}, longitude ${targetLng}.`;
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: query,
            config: {
              tools: [{ googleMaps: {} }],
              toolConfig: {
                retrievalConfig: {
                  latLng: { latitude: targetLat, longitude: targetLng }
                }
              }
            }
          });
          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          for (const chunk of chunks as any[]) {
            if (chunk.maps?.title) {
              const title = chunk.maps.title;
              if (!places.some(p => p.title.toLowerCase() === title.toLowerCase())) {
                places.push({
                  title,
                  uri: chunk.maps.uri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title)}`,
                  address: 'Verified on Google Maps'
                });
              }
            }
          }
        } catch (geminiErr) {
          console.warn('Gemini Maps grounding optional enrichment skipped:', geminiErr);
        }
      }

      // Sort by distance
      places.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

      res.json({
        places: places.slice(0, 20),
        resolvedCoords: { lat: targetLat, lng: targetLng }
      });
    } catch (err) {
      console.error('Nearby search error:', err);
      res.status(500).json({ error: 'Failed to search nearby places', places: [] });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MediMind Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
