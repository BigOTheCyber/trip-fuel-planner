import { Elysia } from 'elysia';

const PORT = Number(process.env.PORT) || 3000;

// ฟังก์ชันอ่านไฟล์ CSV และแปลงเป็นข้อมูลปั๊ม
async function getStationsFromCSV() {
  try {
    const fileText = await Bun.file('data/stations.csv').text();
    const lines = fileText.trim().split('\n');
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const station: any = {};
      headers.forEach((header, index) => {
        station[header] = values[index];
      });

      // ดึงหลักกิโลเมตร (kmMarker / km / km_marker)
      const km = station.kmMarker || station.km_marker || station.km || 0;
      station.kmMarker = Number(km);

      return station;
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

  // 3. API คำนวณจุดแวะเติมน้ำมัน (ดึงปั๊มจาก data/stations.csv จริง!)
  .post('/api/plan-trip', async ({ body }: { body: any }) => {
    const { carId, fuelLevel = 3, currentKm = 0 } = body || {};

    // อ่านข้อมูลรถจาก data/cars.json
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

    // คำนวณระยะทางที่วิ่งได้จริง (คิด Safety Buffer ที่ 85% ของถัง)
    const fullRange = tankCapacity * fuelEfficiency;
    const currentFuelRatio = fuelLevel / 5;
    const remainingKmCapacity = fullRange * currentFuelRatio;
    const safeMaxKm = Number(currentKm) + (remainingKmCapacity * 0.85);

    // อ่านปั๊มน้ำมันจากไฟล์ data/stations.csv ของเราจริงๆ
    const stations = await getStationsFromCSV();

    // ค้นหาปั๊มที่เหมาะสมที่สุดก่อนน้ำมันหมด
    const validStations = stations.filter(s => s.kmMarker > Number(currentKm) && s.kmMarker <= safeMaxKm);
    const recommended = validStations.length > 0 
      ? validStations[validStations.length - 1] 
      : stations.find(s => s.kmMarker > Number(currentKm));

    if (!recommended) {
      return { recommendedStation: null };
    }

    return {
      recommendedStation: {
        name: recommended.name || recommended.stationName || recommended.station_name || 'ปั๊มน้ำมัน',
        brand: recommended.brand || 'Gas Station',
        kmMarker: recommended.kmMarker,
        distanceFromUser: Math.max(0, recommended.kmMarker - Number(currentKm)),
        googleMapUrl: recommended.googleMapUrl || recommended.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(recommended.name || 'ปั๊มน้ำมัน')}`
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