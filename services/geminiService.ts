
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { FrequencyType, ParsedMedicationSchedule, DrugInfo, InteractionAnalysis, LogEntry, VitalEntry, MoodEntry, Medication, PharmacySearchResponse, ConditionAdvice } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const scheduleSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the medicine" },
    dosage: { type: Type.STRING, description: "Dosage amount e.g. 500mg, 1 pill" },
    frequency: { 
      type: Type.STRING, 
      enum: [FrequencyType.DAILY, FrequencyType.WEEKLY, FrequencyType.AS_NEEDED],
      description: "How often the medicine should be taken"
    },
    times: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Array of times in HH:MM 24h format."
    },
    daysOfWeek: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
      description: "Array of integers 0-6 (Sun-Sat) if frequency is WEEKLY."
    },
    notes: { type: Type.STRING, description: "Any special instructions like 'with food'" },
    currentStock: { type: Type.INTEGER, description: "Total quantity of pills/units the user currently has." }
  },
  required: ["name", "frequency", "times"],
};

export const parseMedicationInput = async (input: string): Promise<ParsedMedicationSchedule | null> => {
  if (!process.env.API_KEY) return null;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Parse this medication reminder request into a structured schedule: "${input}". 
      If the user does not specify a time, infer logical default times.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: scheduleSchema,
      },
    });
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as ParsedMedicationSchedule;
  } catch (error) {
    console.error("Error parsing medication:", error);
    return null;
  }
};

export const parseMedicationAudio = async (base64Audio: string, mimeType: string): Promise<ParsedMedicationSchedule | null> => {
  if (!process.env.API_KEY) return null;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Audio } },
          { text: "Parse this medication reminder request from the audio into a structured schedule." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: scheduleSchema,
      },
    });
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as ParsedMedicationSchedule;
  } catch (error) {
    console.error("Error parsing medication audio:", error);
    return null;
  }
};

const pillIdSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    dosage: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] }
  },
  required: ["name", "confidence"]
};

export const identifyPillFromImage = async (base64Image: string): Promise<{name: string, dosage?: string, confidence?: string} | null> => {
  if (!process.env.API_KEY) return null;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: "Analyze this image to identify the medication name and dosage." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: pillIdSchema
      }
    });
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Error identifying pill:", error);
    return null;
  }
};

const drugInfoSchema = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING },
    sideEffects: { type: Type.ARRAY, items: { type: Type.STRING } },
    tips: { type: Type.STRING }
  },
  required: ["description", "sideEffects", "tips"]
};

export const getDrugInfo = async (medName: string): Promise<DrugInfo | null> => {
  if (!process.env.API_KEY) return null;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide a brief summary for the medication: ${medName}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: drugInfoSchema
      }
    });
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as DrugInfo;
  } catch (error) {
    return null;
  }
};

const interactionSchema = {
  type: Type.OBJECT,
  properties: {
    interactions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          medication1: { type: Type.STRING },
          medication2: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ['HIGH', 'MODERATE', 'LOW'] },
          description: { type: Type.STRING }
        },
        required: ["medication1", "medication2", "severity", "description"]
      }
    },
    summary: { type: Type.STRING },
    safeToTake: { type: Type.BOOLEAN }
  },
  required: ["interactions", "summary", "safeToTake"]
};

export const checkInteractions = async (medNames: string[]): Promise<InteractionAnalysis | null> => {
  if (!process.env.API_KEY || medNames.length < 2) return null;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze interactions for: ${medNames.join(', ')}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: interactionSchema
      }
    });
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as InteractionAnalysis;
  } catch (error) {
    return null;
  }
};

export const createMedicalChat = (medications: string[]): Chat => {
  const medList = medications.length > 0 ? medications.join(', ') : "None recorded";
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: `You are MediMind assistant. User medications: ${medList}. Prioritize safety. Markdown allowed.`,
    },
  });
};

export const findNearbyPlaces = async (
  lat: number | null,
  lng: number | null,
  type: 'pharmacy' | 'hospital',
  queryText: string = ''
): Promise<PharmacySearchResponse | null> => {
  // 1. Try server-side endpoint first (combines Overpass + Nominatim + Gemini Maps Grounding)
  try {
    const res = await fetch('/api/places/nearby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, type, queryText })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.places) && data.places.length > 0) {
        return data as PharmacySearchResponse;
      }
    }
  } catch (serverErr) {
    console.warn('Server nearby search fallback to client:', serverErr);
  }

  // 2. Client-side fallback (for standalone APK / offline server scenarios)
  try {
    let targetLat = lat;
    let targetLng = lng;

    if (queryText.trim()) {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(queryText.trim())}`
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (Array.isArray(geoData) && geoData.length > 0) {
          targetLat = parseFloat(geoData[0].lat);
          targetLng = parseFloat(geoData[0].lon);
        }
      }
    }

    // If still no coords, fallback to IP geolocation
    if (targetLat === null || targetLng === null) {
      try {
        const ipRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.latitude && ipData.longitude) {
            targetLat = parseFloat(ipData.latitude);
            targetLng = parseFloat(ipData.longitude);
          }
        }
      } catch (e) {}
    }

    const places: PharmacySearchResponse['places'] = [];

    if (targetLat !== null && targetLng !== null) {
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

      // Query OpenStreetMap Overpass API directly
      try {
        const radiusMeters = 10000;
        const filter =
          type === 'pharmacy'
            ? `node["amenity"="pharmacy"](around:${radiusMeters},${targetLat},${targetLng});way["amenity"="pharmacy"](around:${radiusMeters},${targetLat},${targetLng});node["shop"="chemist"](around:${radiusMeters},${targetLat},${targetLng});`
            : `node["amenity"="hospital"](around:${radiusMeters},${targetLat},${targetLng});way["amenity"="hospital"](around:${radiusMeters},${targetLat},${targetLng});node["amenity"="clinic"](around:${radiusMeters},${targetLat},${targetLng});`;
        const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(`[out:json][timeout:10];(${filter});out center 20;`)}`
        });
        if (overpassRes.ok) {
          const overpassData = await overpassRes.json();
          for (const el of overpassData?.elements || []) {
            const name = el.tags?.name || el.tags?.['name:en'];
            if (!name) continue;
            const elLat = el.lat ?? el.center?.lat;
            const elLng = el.lon ?? el.center?.lon;
            if (typeof elLat !== 'number' || typeof elLng !== 'number') continue;
            const dist = getDistanceKm(targetLat, targetLng, elLat, elLng);
            const street = [el.tags?.['addr:street'], el.tags?.['addr:suburb'] || el.tags?.['addr:city']].filter(Boolean).join(', ');
            places.push({
              title: name,
              uri: `https://www.google.com/maps/dir/?api=1&destination=${elLat},${elLng}`,
              address: street || `${dist} km from your location`,
              distanceKm: dist,
              phone: el.tags?.phone || el.tags?.['contact:phone'],
              lat: elLat,
              lng: elLng
            });
          }
        }
      } catch (e) {}

      // Also try Gemini Maps Grounding if API key present
      if (process.env.API_KEY && places.length < 3) {
        try {
          const query = `Find all nearby ${type === 'pharmacy' ? 'pharmacies and medical stores' : 'hospitals and clinics'} within a 10 kilometer radius. Provide accurate names and direct links to Google Maps.`;
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: query,
            config: {
              tools: [{ googleMaps: {} }],
              toolConfig: {
                retrievalConfig: {
                  latLng: {
                    latitude: targetLat,
                    longitude: targetLng
                  }
                }
              }
            }
          });

          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          chunks
            .filter((chunk: any) => chunk.maps)
            .forEach((chunk: any) => {
              const title = chunk.maps.title || (type === 'pharmacy' ? 'Medical Store' : 'Hospital');
              if (!places.some(p => p.title.toLowerCase() === title.toLowerCase())) {
                places.push({
                  title,
                  uri: chunk.maps.uri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title)}`,
                  address: 'View on Google Maps'
                });
              }
            });
        } catch (e) {}
      }

      places.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
      if (places.length > 0) {
        return { places, resolvedCoords: { lat: targetLat, lng: targetLng } };
      }
    }

    // Guaranteed fallback link so user is never left with an empty screen
    const fallbackQuery = queryText.trim()
      ? `${type === 'pharmacy' ? 'pharmacy medical store' : 'hospital clinic'} near ${queryText.trim()}`
      : `${type === 'pharmacy' ? 'pharmacy medical store' : 'hospital clinic'} near me`;

    return {
      places: [
        {
          title: type === 'pharmacy' ? 'Open Nearby Medical Stores in Google Maps' : 'Open Nearby Hospitals in Google Maps',
          uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery)}`,
          address: 'Tap to view live map & directions around your location'
        }
      ],
      resolvedCoords: targetLat !== null && targetLng !== null ? { lat: targetLat, lng: targetLng } : undefined
    };
  } catch (error) {
    console.error("Error finding places:", error);
    return null;
  }
};

const adviceSchema = {
  type: Type.OBJECT,
  properties: {
    recommendedFoods: { type: Type.ARRAY, items: { type: Type.STRING } },
    avoidFoods: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["recommendedFoods", "avoidFoods"]
};

export const getConditionAdvice = async (condition: string): Promise<ConditionAdvice | null> => {
  if (!process.env.API_KEY) return null;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Provide dietary advice for someone with ${condition}. Include recommended foods and foods to avoid. Return JSON only.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: adviceSchema
      }
    });
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as ConditionAdvice;
  } catch (error) {
    console.error("Error getting advice:", error);
    return null;
  }
};

export const getSmartInsights = async (
  meds: Medication[], 
  logs: LogEntry[], 
  moods: MoodEntry[], 
  vitals: VitalEntry[]
): Promise<string | null> => {
  if (!process.env.API_KEY) return null;
  try {
    const medSummary = meds.map(m => `${m.name} (${m.dosage})`).join(', ');
    const logSummary = logs.slice(-10).map(l => `${l.status} at ${l.scheduledTime || 'N/A'} on ${l.dateStr}`).join('; ');
    const moodSummary = moods.slice(-5).map(m => `${m.type} on ${m.dateStr}`).join('; ');
    const vitalSummary = vitals.slice(-5).map(v => `${v.type}: ${v.value}${v.unit} on ${v.dateStr}`).join('; ');

    const prompt = `Act as a helpful wellness coach. Based on this health data, provide 2-3 concise, highly personalized "Smart Insights" or tips.
    - Meds: ${medSummary}
    - Recent Logs: ${logSummary}
    - Recent Moods: ${moodSummary}
    - Recent Vitals: ${vitalSummary}
    
    Focus on adherence trends, patterns between mood and meds, or vital sign consistency. Use friendly language. Keep it brief. Use bullet points.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    return response.text || null;
  } catch (error) {
    console.error("Error getting smart insights:", error);
    return null;
  }
};

export const generateAIHealthReport = async (
  meds: Medication[],
  logs: LogEntry[],
  moods: MoodEntry[],
  vitals: VitalEntry[],
  userName: string
): Promise<string | null> => {
  if (!process.env.API_KEY) return null;
  try {
    const medSummary = meds.map(m => m.name).join(', ');
    const adherenceRate = Math.round((logs.filter(l => l.status === 'TAKEN').length / Math.max(1, logs.length)) * 100);
    const moodSummary = moods.slice(-7).map(m => m.type).join(', ');
    const recentLogs = logs.slice(-5).map(l => `${l.status} at ${l.scheduledTime}`).join('; ');

    const prompt = `Generate a comprehensive "AI Health Report" for a patient named ${userName}. 
    Data Summary:
    - Medications: ${medSummary}
    - Adherence Rate: ${adherenceRate}%
    - Mood Trends (Last 7 Days): ${moodSummary}
    - Recent Activity: ${recentLogs}

    Structure the report with headers like "Patient Summary" and "Medication Analysis". 
    Focus on adherence stats, mood patterns, and objective recommendations for a doctor. 
    Use a professional yet accessible tone. Highlight key figures like "${adherenceRate}% adherence". 
    Keep it within 200 words.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 1000 }
      }
    });

    return response.text || null;
  } catch (error) {
    console.error("Error generating health report:", error);
    return null;
  }
};
