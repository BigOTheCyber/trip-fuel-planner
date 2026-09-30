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
    const currentFuelRatio = Math.min(Math.max(Number(fuelLevel) / 5, 0), 1);
    const remainingKmCapacity = fullRange * currentFuelRatio;
    const currentPositionKm = Number(currentKm) || 0;

    const stations = await getStationsFromCSV();
    const stationsAhead = stations.filter(s => s.kmMarker > currentPositionKm);

    // Never recommend a station beyond the car's estimated remaining range.
    const reachableStations = stationsAhead.filter(
      s => s.kmMarker <= currentPositionKm + remainingKmCapacity
    );

    if (reachableStations.length === 0) {
      return {
        estimatedRemainingRange: Math.round(remainingKmCapacity * 10) / 10,
        options: []
      };
    }

    function getFurthestStationWithin(ratio: number, excludedIds: string[] = []) {
      const maxKm = currentPositionKm + (remainingKmCapacity * ratio);
      const validStations = reachableStations.filter(
        s => s.kmMarker <= maxKm && !excludedIds.includes(s.id)
      );

      return validStations.length > 0
        ? validStations[validStations.length - 1]
        : null;
    }

    function formatStation(
      station: any,
      type: string,
      title: string,
      description: string
    ) {
      if (!station) return null;

      return {
        type,
        title,
        description,
        name: station.name,
        brand: station.brand,
        kmMarker: Math.round(station.kmMarker * 10) / 10,
        distanceFromUser: Math.max(
          0,
          Math.round((station.kmMarker - currentPositionKm) * 10) / 10
        ),
        googleMapUrl: station.googleMapUrl
      };
    }

    // Option 1: nearest reachable station for drivers who want to refuel soon.
    const refuelSoonStation = reachableStations[0] || null;

    // Option 2: balanced choice, keeping about 20% of the estimated range in reserve.
    let recommendedStation = getFurthestStationWithin(
      0.80,
      refuelSoonStation ? [refuelSoonStation.id] : []
    );

    // If the 80% window is too short to produce a second station, use the next
    // reachable station so the user still gets a meaningful choice.
    if (!recommendedStation) {
      recommendedStation = reachableStations.find(
        s => s.id !== refuelSoonStation?.id
      ) || null;
    }

    const excludedIds = [
      refuelSoonStation?.id,
      recommendedStation?.id
    ].filter(Boolean) as string[];

    // Option 3: farther stop, while still keeping roughly 8% of range in reserve.
    let relaxedStation = getFurthestStationWithin(0.92, excludedIds);

    // If there is no distinct station inside the 92% window, choose the furthest
    // remaining reachable station rather than duplicating another card.
    if (!relaxedStation) {
      const remainingChoices = reachableStations.filter(
        s => !excludedIds.includes(s.id)
      );
      relaxedStation = remainingChoices.length > 0
        ? remainingChoices[remainingChoices.length - 1]
        : null;
    }

    const options = [
      formatStation(
        refuelSoonStation,
        'soon',
        'Refuel Soon',
        'The nearest reachable fuel station ahead.'
      ),
      formatStation(
        recommendedStation,
        'recommended',
        'Recommended',
        'A balanced stop that keeps about 20% of your estimated range in reserve.'
      ),
      formatStation(
        relaxedStation,
        'relaxed',
        'Relaxed',
        'A farther stop for less urgent refuelling, while keeping an emergency reserve.'
      )
    ].filter(Boolean);

    return {
      estimatedRemainingRange: Math.round(remainingKmCapacity * 10) / 10,
      options
    };
  })

  .listen({
    port: PORT,
    hostname: '0.0.0.0'
  }, (server) => {
    console.log(`🚀 Trip Fuel Planner is running at http://${server.hostname}:${server.port}`);
  });