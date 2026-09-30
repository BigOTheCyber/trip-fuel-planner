import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import fs from 'fs';
import path from 'path';

interface Car {
  id: string;
  brand: string;
  model: string;
  tankCapacity: number;
  consumptionKmL: number;
}

interface Station {
  id: string;
  name: string;
  brand: string;
  kmMarker: number;
  lat: number;
  lng: number;
  googleMapUrl?: string;
}

// โหลดข้อมูล Cars
let cars: Car[] = [];
try {
  const carsData = fs.readFileSync(path.join(__dirname, 'cars.json'), 'utf-8');
  cars = JSON.parse(carsData);
} catch (e) {
  console.error('Failed to load cars.json', e);
}

// โหลดข้อมูล Stations
let stations: Station[] = [];
try {
  const stationsData = fs.readFileSync(path.join(__dirname, 'stations.json'), 'utf-8');
  stations = JSON.parse(stationsData);
  
  // ปรับแก้ KM Marker ที่เพี้ยนช่วง มฟล.
  stations = stations.map(s => {
    let km = Number(s.kmMarker);
    const name = s.name || '';
    if (name.includes('ฟ้าไทย') || name.includes('มฟล')) {
      if (km < 200) km = 285.5;
    }
    if (name.includes('ศูนย์การแพทย์')) {
      if (km < 200) km = 287.0;
    }
    return { ...s, kmMarker: km };
  });
} catch (e) {
  console.error('Failed to load stations.json', e);
}

// สูตรคำนวณระยะห่างพิกัดจริง (Haversine Formula)
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const app = new Elysia()
  .use(cors())
  // 1. Route สำหรับเสิร์ฟ index.html
  .get('/', ({ set }) => {
    const rootIndex = path.join(__dirname, 'index.html');
    const publicIndex = path.join(__dirname, 'public', 'index.html');

    if (fs.existsSync(rootIndex)) {
      return Bun.file(rootIndex);
    } else if (fs.existsSync(publicIndex)) {
      return Bun.file(publicIndex);
    } else {
      set.status = 404;
      return 'index.html not found on server';
    }
  })
  // 2. API Routes
  .get('/api/cars', () => cars)
  .get('/api/stations', () => stations)
  .post('/api/plan-trip', ({ body, set }) => {
    const { carId, fuelLevel, currentKm = 0 } = body;

    const car = cars.find(c => c.id === carId);
    if (!car) {
      set.status = 400;
      return { error: 'Car model not found' };
    }

    const fuelRatio = fuelLevel / 5;
    const currentFuelLiters = car.tankCapacity * fuelRatio;
    const maxRangeKm = currentFuelLiters * (car.consumptionKmL || 15);

    const currentStation = stations.find(s => Math.abs(s.kmMarker - currentKm) < 0.1) || { kmMarker: currentKm, lat: 0, lng: 0 };

    const stationsAhead = stations
      .filter(s => s.kmMarker > currentKm + 0.1)
      .map(s => {
        let dist = Number((s.kmMarker - currentStation.kmMarker).toFixed(1));
        if (currentStation.lat && currentStation.lng && s.lat && s.lng) {
          const gpsDist = getHaversineDistance(currentStation.lat, currentStation.lng, s.lat, s.lng);
          if (dist <= 0 || Math.abs(dist - gpsDist) > 50) {
            dist = Number(gpsDist.toFixed(1));
          }
        }

        return {
          ...s,
          distanceFromUser: dist,
          googleMapUrl: s.googleMapUrl || `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`
        };
      })
      .sort((a, b) => a.distanceFromUser - b.distanceFromUser);

    if (stationsAhead.length === 0) {
      return { recommendations: [], message: 'No stations found ahead' };
    }

    const reachable = stationsAhead.filter(s => s.distanceFromUser <= maxRangeKm);

    if (reachable.length === 0) {
      const nearest = stationsAhead[0];
      return {
        recommendations: [{
          level: 'RED',
          title: 'URGENT (PANIC MODE)',
          description: 'Warning: Fuel range exceeded! Stop at nearest station immediately.',
          station: nearest
        }]
      };
    }

    const recommendations = [];
    const usedStationIds = new Set<string>();

    // 🔴 RED (Urgent)
    const urgentStation = reachable[0];
    recommendations.push({
      level: 'RED',
      title: 'URGENT (PANIC MODE)',
      description: 'Refuel soon at an early station along your route.',
      station: urgentStation
    });
    usedStationIds.add(urgentStation.id);

    // 🟡 YELLOW (Moderate)
    const targetModDist = maxRangeKm * 0.5;
    const modCandidates = reachable.filter(s => !usedStationIds.has(s.id));

    if (modCandidates.length > 0) {
      const moderateStation = modCandidates.reduce((prev, curr) =>
        Math.abs(curr.distanceFromUser - targetModDist) < Math.abs(prev.distanceFromUser - targetModDist) ? curr : prev
      );
      recommendations.push({
        level: 'YELLOW',
        title: 'MODERATE (BALANCED DISTANCE)',
        description: 'Standard recommended stop at a comfortable distance.',
        station: moderateStation
      });
      usedStationIds.add(moderateStation.id);
    }

    // 🟢 GREEN (Relaxed)
    const safeMaxRange = maxRangeKm * 0.85;
    const relaxedCandidates = reachable.filter(s => !usedStationIds.has(s.id) && s.distanceFromUser <= safeMaxRange);

    if (relaxedCandidates.length > 0) {
      const relaxedStation = relaxedCandidates[relaxedCandidates.length - 1];
      recommendations.push({
        level: 'GREEN',
        title: 'RELAXED (MAXIMUM SAFE RANGE)',
        description: 'Drive as far as safely possible before reaching fuel reserve.',
        station: relaxedStation
      });
      usedStationIds.add(relaxedStation.id);
    } else {
      const remainingCandidates = reachable.filter(s => !usedStationIds.has(s.id));
      if (remainingCandidates.length > 0) {
        const relaxedStation = remainingCandidates[remainingCandidates.length - 1];
        recommendations.push({
          level: 'GREEN',
          title: 'RELAXED (MAXIMUM SAFE RANGE)',
          description: 'Drive as far as safely possible before reaching fuel reserve.',
          station: relaxedStation
        });
        usedStationIds.add(relaxedStation.id);
      }
    }

    return { recommendations };
  }, {
    // Validation สกีมาข้อมูลขาเข้าสำหรับ /api/plan-trip
    body: t.Object({
      carId: t.String(),
      fuelLevel: t.Number(),
      currentKm: t.Optional(t.Number())
    })
  })
  .listen(process.env.PORT || 3000);

console.log(`Server running on port ${app.server?.port}`);