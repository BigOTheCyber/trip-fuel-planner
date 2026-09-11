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
  .get('/', () => Bun.file('index.html'))
  .get('/index.html', () => Bun.file('index.html'))

  .get('/api/cars', async () => {
    try {
      return await Bun.file('data/cars.json').json();
    } catch (error) {
      return { status: 'error', message: 'Cars data not found' };
    }
  })

  .get('/api/stations', async () => {
    return await getStationsFromCSV();
  })

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

    const fullRange = tankCapacity * fuelEfficiency;
    const currentFuelRatio = Number(fuelLevel) / 5;
    const remainingKmCapacity = fullRange * currentFuelRatio;

    let bufferRatio = 0.85;
    if (Number(fuelLevel) === 1) {
      bufferRatio = 0.50;
    } else if (Number(fuelLevel) === 2) {
      bufferRatio = 0.70;
    }

    const safeMaxKm = Number(currentKm) + (remainingKmCapacity * bufferRatio);
    const stations = await getStationsFromCSV();

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

  .listen({
    port: PORT,
    hostname: '0.0.0.0'
  }, (server) => {
    console.log(`🚀 Trip Fuel Planner is running at http://${server.hostname}:${server.port}`);
  });