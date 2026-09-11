import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());
app.use(express.static('public')); // หรือโฟลเดอร์ที่เก็บ index.html

// โหลดข้อมูลจากไฟล์ JSON/CSV
const carsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'cars.json'), 'utf-8'));
const stationsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'stations.json'), 'utf-8')); 

// API ดึงรายการรถ
app.get('/api/cars', (req: Request, res: Response) => {
  res.json(carsData);
});

// API ดึงรายการปั๊มทั้งหมด
app.get('/api/stations', (req: Request, res: Response) => {
  res.json(stationsData);
});

// API คำนวณจุดเติมน้ำมัน
app.post('/api/plan-trip', (req: Request, res: Response) => {
  const { carId, fuelLevel, currentKm } = req.body;

  // 1. ค้นหารายละเอียดรถ
  const car = carsData.find((c: any) => c.id === carId);
  if (!car) {
    return res.status(400).json({ error: 'Car not found' });
  }

  const fuelEfficiency = car.fuelEfficiency || 12.5; // กม./ลิตร
  const tankCapacity = car.tankCapacity || 50;       // ลิตร
  const currentFuelLiters = (tankCapacity * (fuelLevel / 5));
  
  // ระยะทางที่รถยังวิ่งได้จริง (กม.)
  const totalRangeKm = currentFuelLiters * fuelEfficiency;
  
  // ระยะปลอดภัย (Safety Buffer)
  const safetyBufferKm = 40; 
  
  // ระยะทางสูงสุดที่วิ่งได้อย่างปลอดภัยก่อนต้องเติมน้ำมัน
  const safeDriveKm = Math.max(0, totalRangeKm - safetyBufferKm);
  const targetKm = currentKm + safeDriveKm;

  // 2. ค้นหาปั๊มที่อยู่ข้างหน้า (เรียงตามระยะทาง KM Marker)
  const upcomingStations = stationsData
    .filter((s: any) => s.kmMarker > currentKm)
    .map((s: any) => ({
      ...s,
      distanceFromUser: s.kmMarker - currentKm
    }))
    .sort((a: any, b: any) => a.kmMarker - b.kmMarker);

  if (upcomingStations.length === 0) {
    return res.json({ recommendedStation: null, backupStations: [], safetyBufferKm });
  }

  // 3. หาปั๊มแนะนำ (ปั๊มที่ไกลที่สุดแต่ยังอยู่ในระยะ safeDriveKm)
  let recommended = upcomingStations
    .filter((s: any) => s.kmMarker <= targetKm)
    .pop();

  // ถ้าไม่มีปั๊มไหนอยู่ในระยะปลอดภัยเลย ให้เลือกปั๊มแรกที่ใกล้ที่สุด
  if (!recommended) {
    recommended = upcomingStations[0];
  }

  // 4. หาปั๊มสำรองใกล้เคียง (เลือกปั๊มที่อยู่ก่อนหน้าหรือถัดไปจากปั๊มแนะนำ 2 ปั๊ม)
  const backupStations = upcomingStations
    .filter((s: any) => s.id !== recommended.id)
    .slice(0, 2);

  return res.json({
    recommendedStation: recommended,
    backupStations: backupStations,
    safetyBufferKm: safetyBufferKm
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});