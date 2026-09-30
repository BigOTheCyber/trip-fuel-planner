import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());
app.use(express.static('public'));

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

// โหลดข้อมูล Cars & Stations
let cars: Car[] = [];
let stations: Station[] = [];

try {
  const carsData = fs.readFileSync(path.join(__dirname, 'cars.json'), 'utf-8');
  cars = JSON.parse(carsData);
} catch (e) {
  console.error('Failed to load cars.json', e);
}

try {
  const stationsData = fs.readFileSync(path.join(__dirname, 'stations.json'), 'utf-8');
  stations = JSON.parse(stationsData);
  
  // Sanitize & Fix Known KM Marker Anomalies (แก้ไขค่า KM ที่เพี้ยนของปั๊มแถว มฟล.)
  stations = stations.map(s => {
    let km = Number(s.kmMarker);
    const name = s.name || '';
    
    // แก้ไขค่า KM ของปั๊มแถว มฟล. ให้ต่อเนื่องถูกต้องกับปั๊มแม่กรณ์ (KM ~307)
    if (name.includes('ฟ้าไทย') || name.includes('มฟล')) {
      if (km < 200) km = 285.5; // ปรับให้อยู่ก่อนถึงเมืองเชียงราย
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
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

app.get('/api/cars', (req, res) => res.json(cars));
app.get('/api/stations', (req, res) => res.json(stations));

app.post('/api/plan-trip', (req, res) => {
  const { carId, fuelLevel, currentKm = 0 } = req.body;

  const car = cars.find(c => c.id === carId);
  if (!car) {
    return res.status(400).json({ error: 'Car model not found' });
  }

  // 1. คำนวณระยะทางที่วิ่งได้จริงจากระดับน้ำมัน (fuelLevel 1..5)
  const fuelRatio = fuelLevel / 5;
  const currentFuelLiters = car.tankCapacity * fuelRatio;
  const maxRangeKm = currentFuelLiters * (car.consumptionKmL || 15);

  // จุดเริ่มต้นปัจจุบันของผู้ใช้
  const currentStation = stations.find(s => Math.abs(s.kmMarker - currentKm) < 0.1) || { kmMarker: currentKm, lat: 0, lng: 0 };

  // 2. กรองเฉพาะสถานีที่อยู่ข้างหน้า (kmMarker > currentKm)
  const stationsAhead = stations
    .filter(s => s.kmMarker > currentKm + 0.1) // ต้องอยู่ข้างหน้าจริงอย่างน้อย 100 เมตร
    .map(s => {
      // ใช้ระยะตาม KM Marker ถนนเป็นหลัก
      let dist = Number((s.kmMarker - currentStation.kmMarker).toFixed(1));
      
      // ถ้ามีพิกัด GPS ทั้งคู่ และระยะทาง KM ดูผิดปกติ ให้ใช้ระยะทางจริงจาก GPS
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
    return res.json({ recommendations: [], message: 'No stations found ahead' });
  }

  // สถานีที่สามารถไปถึงได้ก่อนน้ำมันหมด
  const reachable = stationsAhead.filter(s => s.distanceFromUser <= maxRangeKm);

  if (reachable.length === 0) {
    // ถ้าน้ำมันไม่พอถึงสักปั๊ม ให้เตือนปั๊มแรกสุดที่อยู่ใกล้ที่สุดทันที
    const nearest = stationsAhead[0];
    return res.json({
      recommendations: [{
        level: 'RED',
        title: 'URGENT (PANIC MODE)',
        description: 'Warning: Fuel range exceeded! Stop at nearest station immediately.',
        station: nearest
      }]
    });
  }

  // 3. STRICT DEDUPLICATION LOGIC (ห้ามมีปั๊มซ้ำเด็ดขาด)
  const recommendations = [];
  const usedStationIds = new Set<string>();

  // 🔴 1. RED (Urgent): ปั๊มแรกสุดที่เจอข้างหน้า
  const urgentStation = reachable[0];
  recommendations.push({
    level: 'RED',
    title: 'URGENT (PANIC MODE)',
    description: 'Refuel soon at an early station along your route.',
    station: urgentStation
  });
  usedStationIds.add(urgentStation.id);

  // 🟡 2. YELLOW (Moderate): ปั๊มช่วงกลาง (ประมาณ 40-60% ของระยะถัง) ต้องไม่ซ้ำกับ RED
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

  // 🟢 3. GREEN (Relaxed): ปั๊มไกลสุดในระยะปลอดภัย (ไม่เกิน 85% ของถัง) ต้องไม่ซ้ำกับ RED และ YELLOW
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
    // ถ้าปั๊มในกลุ่ม safeMaxRange ถูกใช้ไปหมดแล้ว ให้เอาปั๊มที่เหลืออยู่ไกลที่สุดในกลุ่ม reachable
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

  res.json({ recommendations });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));