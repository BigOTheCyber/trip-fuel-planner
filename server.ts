import { Elysia } from 'elysia';

const PORT = Number(process.env.PORT) || 3000;

async function getStationsFromCSV() {
  try {
    const fileText = await Bun.file('data/stations.csv').text();
    const lines = fileText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    let accumulatedKm = 0;

    return lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i];
      });

      const name = row['ชื่อปั๊มน้ำมัน'] || row['name'] || 'Gas Station';
      const brand = row['แบรนด์'] || row['brand'] || 'Station';
      const mapUrl = row['Google Maps Link'] || row['googleMapUrl'] || '';
      const lat = parseFloat(row['Latitude'] || '0') || 0;
      const lng = parseFloat(row['Longitude'] || '0') || 0;
      
      const distFromPrev = parseFloat(row['ห่างจากปั๊มก่อนหน้า (KM)'] || '0') || 0;
      accumulatedKm += distFromPrev;

      return {
        id: `station-${index}`,
        name,
        brand,
        lat,
        lng,
        googleMapUrl: mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,
        kmMarker: accumulatedKm
      };
    });
  } catch (error) {
    console.error('Error reading stations.csv:', error);
    return [];
  }
}

const app = new Elysia()
  // เสิร์ฟหน้า Web App หลัก (index.html)
  .get('/', () => Bun.file('index.html'))
  .get('/index.html', () => Bun.file('index.html'))

  // API ดึงข้อมูลรถยนต์
  .get('/api/cars', async () => {
    try {
      return await Bun.file('data/cars.json').json();
    } catch (error) {
      return { status: 'error', message: 'Cars data not found' };
    }
  })

  // API ดึงข้อมูลปั๊มน้ำมัน
  .get('/api/stations', async () => {
    return await getStationsFromCSV();
  })

  // API คำนวณและแนะนำจุดแวะเติมน้ำมัน (3 ปั๊ม 3 สี)
  .post('/api/plan-trip', async ({ body }: { body: any }) => {
    const { carId, fuelLevel = 3, currentKm = 0 } = body || {};

    let cars: any[] = [];
    try {
      const carsData = await Bun.file('data/cars.json').json();
      cars = Array.isArray(carsData) ? carsData : (carsData.data || []);
    } catch (e) {
      cars = [];
    }

    const selectedCar = cars.find(c => String(c.id) === String(carId)) || { tankCapacity: 45, fuelEfficiency: 15 };
    const tankCapacity = Number(selectedCar.tankCapacity) || 45;
    const fuelEfficiency = Number(selectedCar.fuelEfficiency) || 15;

    // คำนวณระยะทางสูงสุด theoretical และหัก Safety Buffer (15% Reserve)
    const fullRange = tankCapacity * fuelEfficiency;
    const currentFuelRatio = Number(fuelLevel) / 5;
    const remainingKmCapacity = fullRange * currentFuelRatio;

    // Safety Reserve 15% (คิด Buffer 85% สำหรับปกติ และปรับลดถ้าขีดน้ำมันต่ำ)
    let bufferRatio = 0.85;
    if (Number(fuelLevel) === 1) {
      bufferRatio = 0.50;
    } else if (Number(fuelLevel) === 2) {
      bufferRatio = 0.70;
    }

    const safeMaxKm = Number(currentKm) + (remainingKmCapacity * bufferRatio);
    const stations = await getStationsFromCSV();

    // คัดเลือกปั๊มทั้งหมดที่อยู่ในระยะทางปลอดภัยข้างหน้า
    const validStations = stations.filter(s => s.kmMarker > Number(currentKm) && s.kmMarker <= safeMaxKm);

    if (validStations.length === 0) {
      // กรณีไม่พบปั๊มในระยะปลอดภัย ให้ดึงปั๊มแรกสุดที่อยู่ข้างหน้าแทน
      const nearestFallback = stations.find(s => s.kmMarker > Number(currentKm));
      return {
        recommendedStation: nearestFallback ? {
          name: nearestFallback.name,
          brand: nearestFallback.brand,
          kmMarker: Math.round(nearestFallback.kmMarker * 10) / 10,
          distanceFromUser: Math.max(0, Math.round((nearestFallback.kmMarker - Number(currentKm)) * 10) / 10),
          googleMapUrl: nearestFallback.googleMapUrl
        } : null,
        recommendations: []
      };
    }

    // 🔴 Red Station: ปั๊มแรกสุดข้างหน้า (Panic Mode / เติมด่วน)
    const redStation = validStations[0];

    // 🟡 Yellow Station: ปั๊มช่วงกลางๆ ของระยะปลอดภัย
    const midIndex = Math.floor((validStations.length - 1) / 2);
    const yellowStation = validStations[midIndex];

    // 🟢 Green Station: ปั๊มไกลที่สุดในระยะปลอดภัย (ชิลๆ ลากยาวได้)
    const greenStation = validStations[validStations.length - 1];

    const formatStation = (st: any) => ({
      name: st.name,
      brand: st.brand,
      kmMarker: Math.round(st.kmMarker * 10) / 10,
      distanceFromUser: Math.max(0, Math.round((st.kmMarker - Number(currentKm)) * 10) / 10),
      googleMapUrl: st.googleMapUrl
    });

    return {
      // ส่งแบบเดิมเผื่อ Frontend โครงสร้างเก่าเรียกใช้
      recommendedStation: formatStation(greenStation),
      // ส่งแบบใหม่ 3 ปั๊ม 3 สี
      recommendations: [
        {
          level: 'RED',
          title: '🔴 รีบที่สุด (Panic Mode)',
          description: 'แวะเติมทันทีตั้งแต่เนิ่นๆ ในปั๊มแรกที่เจอข้างหน้า',
          station: formatStation(redStation)
        },
        {
          level: 'YELLOW',
          title: '🟡 รีบกลาง (ระยะกำลังดี)',
          description: 'จุดแวะมาตรฐาน ระยะทางกำลังเหมาะสม',
          station: formatStation(yellowStation)
        },
        {
          level: 'GREEN',
          title: '🟢 รีบน้อย (ชิลๆ ลากยาวได้)',
          description: 'วิ่งต่อได้ไกลที่สุดก่อนเข้าเขตน้ำมันสำรอง',
          station: formatStation(greenStation)
        }
      ]
    };
  })

  .listen({
    port: PORT,
    hostname: '0.0.0.0'
  }, (server) => {
    console.log(`🚀 Trip Fuel Planner is running at http://${server.hostname}:${server.port}`);
  });