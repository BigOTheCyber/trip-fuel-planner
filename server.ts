import { Elysia } from 'elysia';

const PORT = Number(process.env.PORT) || 3000;

// ฟังก์ชันอ่านไฟล์ CSV และคำนวณหลักกิโลเมตรสะสม
async function getStationsFromCSV() {
  try {
    const fileText = await Bun.file('data/stations.csv').text();
    const lines = fileText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    let accumulatedKm = 0;

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      // ดึงข้อมูลตามชื่อคอลัมน์ภาษาไทยในไฟล์ CSV ของเรา
      const name = row['ชื่อปั๊มน้ำมัน'] || row['name'] || 'ปั๊มน้ำมัน';
      const brand = row['แบรนด์'] || row['brand'] || 'Gas Station';
      const mapUrl = row['Google Maps Link'] || row['googleMapUrl'] || '';
      
      // ดึงระยะห่างจากปั๊มก่อนหน้า แล้วบวกสะสมเป็น กม. รวม
      const distFromPrev = parseFloat(row['ห่างจากปั๊มก่อนหน้า (KM)'] || '0') || 0;
      accumulatedKm += distFromPrev;

      return {
        name,
        brand,
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
  // 1. หน้าเว็บหลัก
  .get('/', () => Bun.file('index.html'))
  .get('/index.html', () => Bun.file('index.html'))

  // 2. API ดึงข้อมูลรถยนต์
  .get('/api/cars', async () => {
    try {
      return await Bun.file('data/cars.json').json();
    } catch (error) {
      return { status: 'error', message: 'Cars data not found' };
    }
  })

  // 3. API คำนวณจุดแวะเติมน้ำมัน
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

    // คำนวณระยะทางที่วิ่งได้จริง (Safety Buffer 85%)
    const fullRange = tankCapacity * fuelEfficiency;
    const currentFuelRatio = fuelLevel / 5;
    const remainingKmCapacity = fullRange * currentFuelRatio;
    const safeMaxKm = Number(currentKm) + (remainingKmCapacity * 0.85);

    // ดึงข้อมูลปั๊มพร้อมหลัก กม. ที่คำนวณสะสมแล้ว
    const stations = await getStationsFromCSV();

    // ค้นหาปั๊มที่เหมาะสมก่อนน้ำมันหมด
    const validStations = stations.filter(s => s.kmMarker > Number(currentKm) && s.kmMarker <= safeMaxKm);
    const recommended = validStations.length > 0 
      ? validStations[validStations.length - 1] 
      : stations.find(s => s.kmMarker > Number(currentKm));

    if (!recommended) {
      return { recommendedStation: null };
    }

    return {
      recommendedStation: {
        name: recommended.name,
        brand: recommended.brand,
        kmMarker: Math.round(recommended.kmMarker * 10) / 10,
        distanceFromUser: Math.max(0, Math.round((recommended.kmMarker - Number(currentKm)) * 10) / 10),
        googleMapUrl: recommended.googleMapUrl
      }
    };
  })

  // 4. เริ่มรัน Server
  .listen({
    port: PORT,
    hostname: '0.0.0.0'
  }, (server) => {
    console.log(`🚀 Trip Fuel Planner is running at http://${server.hostname}:${server.port}`);
  });