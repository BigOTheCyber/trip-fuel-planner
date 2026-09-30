import { Elysia } from 'elysia';

const PORT = Number(process.env.PORT) || 3000;

async function getStationsFromCSV() {
  try {
    const fileText = await Bun.file('data/stations.csv').text();

    const lines = fileText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length <= 1) {
      return [];
    }

    const headers = lines[0]
      .split(',')
      .map(h => h.trim().replace(/^"|"$/g, ''));

    let accumulatedKm = 0;

    return lines.slice(1).map((line, index) => {
      const values = line
        .split(',')
        .map(v => v.trim().replace(/^"|"$/g, ''));

      const row: any = {};

      headers.forEach((header, i) => {
        row[header] = values[i];
      });

      const name =
        row['ชื่อปั๊มน้ำมัน'] ||
        row['name'] ||
        'Gas Station';

      const brand =
        row['แบรนด์'] ||
        row['brand'] ||
        'Station';

      const mapUrl =
        row['Google Maps Link'] ||
        row['googleMapUrl'] ||
        '';

      const lat =
        parseFloat(row['Latitude'] || '0') || 0;

      const lng =
        parseFloat(row['Longitude'] || '0') || 0;

      const distFromPrev =
        parseFloat(
          row['ห่างจากปั๊มก่อนหน้า (KM)'] || '0'
        ) || 0;

      accumulatedKm += distFromPrev;

      return {
        id: `station-${index}`,
        name,
        brand,
        lat,
        lng,
        googleMapUrl:
          mapUrl ||
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,
        kmMarker: accumulatedKm
      };
    });

  } catch (error) {
    console.error(
      'Error reading stations.csv:',
      error
    );

    return [];
  }
}



const app = new Elysia()

  .get('/', () => {
    return Bun.file('index.html');
  })

  .get('/index.html', () => {
    return Bun.file('index.html');
  })



  .get('/api/cars', async () => {
    try {
      return await Bun.file(
        'data/cars.json'
      ).json();

    } catch (error) {
      return {
        status: 'error',
        message: 'Cars data not found'
      };
    }
  })



  .get('/api/stations', async () => {
    return await getStationsFromCSV();
  })



  .post(
    '/api/plan-trip',

    async ({ body }: { body: any }) => {

      const {
        carId,
        fuelLevel = 3,
        currentKm = 0
      } = body || {};


      let cars: any[] = [];

      try {
        const carsData =
          await Bun.file(
            'data/cars.json'
          ).json();

        cars =
          Array.isArray(carsData)
            ? carsData
            : (carsData.data || []);

      } catch (e) {
        cars = [];
      }



      const selectedCar =
        cars.find(
          c =>
            String(c.id) ===
            String(carId)
        )
        ||
        {
          tankCapacity: 45,
          fuelEfficiency: 15
        };


      const tankCapacity =
        Number(
          selectedCar.tankCapacity
        ) || 45;


      const fuelEfficiency =
        Number(
          selectedCar.fuelEfficiency
        ) || 15;



      const fullRange =
        tankCapacity *
        fuelEfficiency;


      const currentFuelRatio =
        Math.min(
          Math.max(
            Number(fuelLevel) / 5,
            0
          ),
          1
        );


      const remainingKmCapacity =
        fullRange *
        currentFuelRatio;


      const currentPositionKm =
        Number(currentKm) || 0;



      const stations =
        await getStationsFromCSV();


      const stationsAhead =
        stations.filter(
          station =>
            station.kmMarker >
            currentPositionKm
        );



      function getFurthestStationWithin(
        ratio: number,
        excludedIds: string[] = []
      ) {

        const maxKm =
          currentPositionKm +
          (
            remainingKmCapacity *
            ratio
          );


        const validStations =
          stationsAhead.filter(
            station =>
              station.kmMarker <= maxKm &&
              !excludedIds.includes(
                station.id
              )
          );


        if (
          validStations.length === 0
        ) {
          return null;
        }


        return validStations[
          validStations.length - 1
        ];
      }



      function formatStation(
        station: any,
        type: string,
        title: string,
        description: string
      ) {

        if (!station) {
          return null;
        }


        return {
          type,
          title,
          description,

          name:
            station.name,

          brand:
            station.brand,

          kmMarker:
            Math.round(
              station.kmMarker * 10
            ) / 10,

          distanceFromUser:
            Math.max(
              0,
              Math.round(
                (
                  station.kmMarker -
                  currentPositionKm
                ) * 10
              ) / 10
            ),

          googleMapUrl:
            station.googleMapUrl
        };
      }



      // =========================
      // OPTION 1 — REFUEL SOON
      // =========================

      const soonStation =
        stationsAhead.length > 0
          ? stationsAhead[0]
          : null;



      // =========================
      // OPTION 2 — RECOMMENDED
      // =========================

      let recommendedRatio = 0.85;


      if (
        Number(fuelLevel) === 1
      ) {
        recommendedRatio = 0.45;

      } else if (
        Number(fuelLevel) === 2
      ) {
        recommendedRatio = 0.60;

      } else if (
        Number(fuelLevel) === 3
      ) {
        recommendedRatio = 0.70;

      } else if (
        Number(fuelLevel) === 4
      ) {
        recommendedRatio = 0.80;
      }



      const recommendedStation =
        getFurthestStationWithin(

          recommendedRatio,

          soonStation
            ? [soonStation.id]
            : []

        );



      // =========================
      // OPTION 3 — RELAXED
      // =========================

      const excludedIds = [
        soonStation?.id,
        recommendedStation?.id
      ].filter(Boolean) as string[];



      const relaxedStation =
        getFurthestStationWithin(
          0.92,
          excludedIds
        );



      // =========================
      // DESCRIPTIONS
      // =========================

      let recommendedDescription =
        'A balanced fuel stop with a comfortable safety reserve.';


      if (
        Number(fuelLevel) === 1
      ) {
        recommendedDescription =
          'Low fuel detected. A closer stop is recommended for a larger safety reserve.';

      } else if (
        Number(fuelLevel) === 2
      ) {
        recommendedDescription =
          'Fuel is running low, so a closer stop is recommended for extra safety.';

      } else if (
        Number(fuelLevel) === 3
      ) {
        recommendedDescription =
          'A safer stop with extra reserve for traffic, delays, or unexpected conditions.';

      }



      const options = [

        formatStation(
          soonStation,
          'soon',
          'Refuel Soon',
          'The nearest fuel station ahead.'
        ),


        formatStation(
          recommendedStation,
          'recommended',
          'Recommended',
          recommendedDescription
        ),


        formatStation(
          relaxedStation,
          'relaxed',
          'Relaxed',
          'Travel farther while keeping an emergency fuel reserve.'
        )

      ].filter(Boolean);



      return {

        estimatedRemainingRange:
          Math.round(
            remainingKmCapacity * 10
          ) / 10,

        options
      };
    }
  )



  .listen(
    {
      port: PORT,
      hostname: '0.0.0.0'
    },

    server => {
      console.log(
        `🚀 Trip Fuel Planner is running at http://${server.hostname}:${server.port}`
      );
    }
  );