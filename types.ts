
export enum FrequencyType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  AS_NEEDED = 'AS_NEEDED',
  INTERVAL = 'INTERVAL'
}

export type SoundType = 'default' | 'chime' | 'alert' | 'soft' | 'harp' | 'nature' | 'arcade' | 'glass' | 'shimmer' | 'echo';

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  themeColor: string;
  preferredSound?: SoundType;
  gender?: string;
  age?: string | number;
  bloodType?: string;
  height?: string | number;
  weight?: string | number;
  allergies?: string[];
  conditions?: string[];
  insurance?: {
    provider: string;
    policyNumber: string;
    groupNumber: string;
    holderName: string;
  };
  emergencyContact?: {
    name: string;
    relation: string;
    phone: string;
  };
}

export interface Medication {
  id: string;
  profileId?: string;
  name: string;
  dosage: string;
  frequency: FrequencyType;
  times: string[];
  daysOfWeek?: number[];
  interval?: number;
  startTime?: string;
  startDate?: string;
  notes?: string;
  color: string;
  icon: string;
  currentStock: number;
  lowStockThreshold: number;
  expiryDate?: string;
  refillDate?: string;
  refillReminderEnabled?: boolean;
  refillReminderTime?: string;
  lastRefillDate?: string;
  reminderSound?: SoundType;
}

export interface LogEntry {
  id: string;
  profileId?: string;
  medicationId: string;
  timestamp: number;
  status: 'TAKEN' | 'SKIPPED';
  scheduledTime?: string;
  dateStr: string;
}

export interface ParsedMedicationSchedule {
  name: string;
  dosage: string;
  frequency: FrequencyType;
  times: string[];
  daysOfWeek?: number[];
  notes?: string;
  currentStock?: number;
}

export interface DrugInfo {
  description: string;
  sideEffects: string[];
  tips: string;
}

export interface Interaction {
  medication1: string;
  medication2: string;
  severity: 'HIGH' | 'MODERATE' | 'LOW';
  description: string;
}

export interface InteractionAnalysis {
  interactions: Interaction[];
  summary: string;
  safeToTake: boolean;
}

export type VitalType = 'BLOOD_PRESSURE' | 'GLUCOSE' | 'HEART_RATE' | 'WEIGHT';

export interface VitalEntry {
  id: string;
  profileId?: string;
  type: VitalType;
  value: string;
  unit: string;
  dateStr: string;
  timestamp: number;
}

export interface Goal {
  id: string;
  title: string;
  completed: boolean;
}

export type MoodType = 'GREAT' | 'GOOD' | 'OKAY' | 'LOW' | 'PAIN';

export interface MoodEntry {
  id: string;
  profileId?: string;
  type: MoodType;
  note?: string;
  timestamp: number;
  dateStr: string;
}

export interface SnoozeEntry {
  medicationId: string;
  scheduledTime: string;
  wakeUpTime: number;
}

export interface PharmacyPlace {
  title: string;
  uri: string;
  address?: string;
  distanceKm?: number;
  phone?: string;
  lat?: number;
  lng?: number;
}

export interface PharmacySearchResponse {
  places: PharmacyPlace[];
  resolvedCoords?: { lat: number; lng: number };
}

export interface ConditionAdvice {
  recommendedFoods: string[];
  avoidFoods: string[];
}

export interface Appointment {
  id: string;
  profileId?: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  location: string;
  notes: string;
}
