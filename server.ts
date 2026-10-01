import { Elysia } from 'elysia';

const PORT = Number(process.env.PORT) || 3000;


// =========================================================
// SPECIAL STATION PRESETS
// =========================================================

const SPECIAL_STATION_PRESETS = [
  {
    keywords: ['งาว', 'ngao', 'ngaw'],
    title: 'Featured Route Stop',
    description:
      'A featured stop around Ngao, highlighted when it fits safely within your remaining fuel range.',
    tags: [
      'Featured Stop',
      'Route Break'
    ],
    priority: 10
  }
];


// =========================================================
// HELPERS
// =========================================================

function parseBoolean(value: any) {
  const normalized =
    String(value || '')
      .trim()
      .toLowerCase();

  return [
    'true',
    '1',
    'yes',
    'y'
  ].includes(normalized);
}


function getSpecialPreset(name: string) {
  const normalizedName =
    String(name || '')
      .toLowerCase();

  return SPECIAL_STATION_PRESETS.find(
    preset =>
      preset.keywords.some(
        keyword =>
          normalizedName.includes(
            keyword.toLowerCase()
          )
      )
  );
}


// =========================================================
// READ STATIONS CSV
// =========================================================

async function getStationsFromCSV() {
  try {
    const fileText =
      await Bun.file(
        'data/stations.csv'
      ).text();

    const lines =
      fileText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (lines.length <= 1) {
      return [];
    }

    const headers =
      lines[0]
        .split(',')
        .map(
          header =>
            header
              .trim()
              .replace(/^"|"$/g, '')
        );

    let accumulatedKm = 0;

    return lines
      .slice(1)
      .map(
        (line, index) => {
          const values =
            line
              .split(',')
              .map(
                value =>
                  value
                    .trim()
                    .replace(/^"|"$/g, '')
              );

          const row: any = {};

          headers.forEach(
            (header, i) => {
              row[header] =
                values[i];
            }
          );

          const name =
            row['ชื่อปั๊มน้ำมัน']
            ||
            row['name']
            ||
            'Gas Station';

          const brand =
            row['แบรนด์']
            ||
            row['brand']
            ||
            'Station';

          const mapUrl =
            row['Google Maps Link']
            ||
            row['googleMapUrl']
            ||
            '';

          const lat =
            parseFloat(
              row['Latitude']
              ||
              '0'
            )
            ||
            0;

          const lng =
            parseFloat(
              row['Longitude']
              ||
              '0'
            )
            ||
            0;

          const distFromPrev =
            parseFloat(
              row['ห่างจากปั๊มก่อนหน้า (KM)']
              ||
              '0'
            )
            ||
            0;

          accumulatedKm +=
            distFromPrev;


          // =============================================
          // OPTIONAL SPECIAL DATA FROM CSV
          // =============================================

          const csvSpecial =
            parseBoolean(
              row['specialRecommend']
              ||
              row['Special Recommend']
              ||
              row['special']
            );

          const preset =
            getSpecialPreset(
              name
            );

          const isSpecial =
            csvSpecial
            ||
            Boolean(preset);

          const specialTitle =
            row['specialTitle']
            ||
            row['Special Title']
            ||
            preset?.title
            ||
            'Special Recommendation';

          const specialDescription =
            row['specialDescription']
            ||
            row['Special Description']
            ||
            preset?.description
            ||
            'A featured stop selected by the planner for this journey.';

          let specialTags: string[] =
            [];

          const csvTags =
            row['specialTags']
            ||
            row['Special Tags']
            ||
            '';

          if (csvTags) {
            specialTags =
              String(csvTags)
                .split('|')
                .map(
                  tag =>
                    tag.trim()
                )
                .filter(Boolean);

          } else if (preset) {
            specialTags =
              preset.tags;
          }

          const specialPriority =
            Number(
              row['specialPriority']
              ||
              row['Special Priority']
              ||
              preset?.priority
              ||
              0
            )
            ||
            0;


          return {
            id:
              `station-${index}`,

            name,

            brand,

            lat,

            lng,

            googleMapUrl:
              mapUrl
              ||
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,

            kmMarker:
              accumulatedKm,

            isSpecial,

            specialTitle,

            specialDescription,

            specialTags,

            specialPriority
          };
        }
      );

  } catch (error) {
    console.error(
      'Error reading stations.csv:',
      error
    );

    return [];
  }
}


// =========================================================
// APP
// =========================================================

const app =
  new Elysia()


    .get(
      '/',
      () => {
        return Bun.file(
          'index.html'
        );
      }
    )


    .get(
      '/index.html',
      () => {
        return Bun.file(
          'index.html'
        );
      }
    )


    .get(
      '/api/cars',
      async () => {
        try {
          return await Bun.file(
            'data/cars.json'
          ).json();

        } catch (error) {
          return {
            status:
              'error',

            message:
              'Cars data not found'
          };
        }
      }
    )


    .get(
      '/api/stations',
      async () => {
        return await getStationsFromCSV();
      }
    )


    .post(
      '/api/plan-trip',

      async (
        {
          body
        }: {
          body: any
        }
      ) => {

        const {
          carId,
          fuelLevel = 3,
          currentKm = 0
        } =
          body || {};


        // =================================================
        // CAR DATA
        // =================================================

        let cars: any[] =
          [];

        try {
          const carsData =
            await Bun.file(
              'data/cars.json'
            ).json();

          cars =
            Array.isArray(
              carsData
            )
              ?
              carsData
              :
              (
                carsData.data
                ||
                []
              );

        } catch (error) {
          cars =
            [];
        }


        const selectedCar =
          cars.find(
            car =>
              String(car.id)
              ===
              String(carId)
          )
          ||
          {
            tankCapacity:
              45,

            fuelEfficiency:
              15
          };


        const tankCapacity =
          Number(
            selectedCar.tankCapacity
          )
          ||
          45;


        const fuelEfficiency =
          Number(
            selectedCar.fuelEfficiency
          )
          ||
          15;


        const fullRange =
          tankCapacity
          *
          fuelEfficiency;


        const currentFuelRatio =
          Math.min(
            Math.max(
              Number(fuelLevel)
              /
              5,
              0
            ),
            1
          );


        const remainingKmCapacity =
          fullRange
          *
          currentFuelRatio;


        const currentPositionKm =
          Number(currentKm)
          ||
          0;


        // =================================================
        // STATIONS
        // =================================================

        const stations =
          await getStationsFromCSV();


        const stationsAhead =
          stations.filter(
            station =>
              station.kmMarker
              >
              currentPositionKm
          );


        function getFurthestStationWithin(
          ratio: number,
          excludedIds: string[] = []
        ) {
          const maxKm =
            currentPositionKm
            +
            (
              remainingKmCapacity
              *
              ratio
            );

          const validStations =
            stationsAhead.filter(
              station =>
                station.kmMarker
                <=
                maxKm
                &&
                !excludedIds.includes(
                  station.id
                )
            );

          if (
            validStations.length
            ===
            0
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
                station.kmMarker
                *
                10
              )
              /
              10,

            distanceFromUser:
              Math.max(
                0,
                Math.round(
                  (
                    station.kmMarker
                    -
                    currentPositionKm
                  )
                  *
                  10
                )
                /
                10
              ),

            googleMapUrl:
              station.googleMapUrl
          };
        }


        // =================================================
        // RECOMMENDED SAFETY RATIO
        // =================================================

        let recommendedRatio =
          0.85;


        if (
          Number(fuelLevel)
          ===
          1
        ) {
          recommendedRatio =
            0.45;

        } else if (
          Number(fuelLevel)
          ===
          2
        ) {
          recommendedRatio =
            0.60;

        } else if (
          Number(fuelLevel)
          ===
          3
        ) {
          recommendedRatio =
            0.70;

        } else if (
          Number(fuelLevel)
          ===
          4
        ) {
          recommendedRatio =
            0.80;
        }


        // =================================================
        // OPTION 1 — REFUEL SOON
        // =================================================

        const soonStation =
          stationsAhead.length > 0
            ?
            stationsAhead[0]
            :
            null;


        // =================================================
        // OPTION 2 — RECOMMENDED
        // =================================================

        const recommendedStation =
          getFurthestStationWithin(
            recommendedRatio,

            soonStation
              ?
              [
                soonStation.id
              ]
              :
              []
          );


        // =================================================
        // OPTION 3 — RELAXED
        // =================================================

        const excludedIds =
          [
            soonStation?.id,
            recommendedStation?.id
          ]
            .filter(Boolean)
          as string[];


        const relaxedStation =
          getFurthestStationWithin(
            0.92,
            excludedIds
          );


        // =================================================
        // DESCRIPTIONS
        // =================================================

        let recommendedDescription =
          'A balanced fuel stop with a comfortable safety reserve.';


        if (
          Number(fuelLevel)
          ===
          1
        ) {
          recommendedDescription =
            'Low fuel detected. A closer stop is recommended for a larger safety reserve.';

        } else if (
          Number(fuelLevel)
          ===
          2
        ) {
          recommendedDescription =
            'Fuel is running low, so a closer stop is recommended for extra safety.';

        } else if (
          Number(fuelLevel)
          ===
          3
        ) {
          recommendedDescription =
            'A safer stop with extra reserve for traffic, delays, or unexpected conditions.';
        }


        const options =
          [
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
          ]
            .filter(Boolean);


        // =================================================
        // SPECIAL RECOMMENDATION
        // =================================================

        const specialSafeMaxKm =
          currentPositionKm
          +
          (
            remainingKmCapacity
            *
            recommendedRatio
          );


        const safeSpecialStations =
          stationsAhead
            .filter(
              station =>
                station.isSpecial
                &&
                station.kmMarker
                <=
                specialSafeMaxKm
            )
            .sort(
              (a, b) => {

                if (
                  b.specialPriority
                  !==
                  a.specialPriority
                ) {
                  return (
                    b.specialPriority
                    -
                    a.specialPriority
                  );
                }

                return (
                  b.kmMarker
                  -
                  a.kmMarker
                );
              }
            );


        const specialStation =
          safeSpecialStations.length > 0
            ?
            safeSpecialStations[0]
            :
            null;


        const specialRecommendation =
          specialStation
            ?
            {
              type:
                'special',

              title:
                specialStation.specialTitle
                ||
                'Special Recommendation',

              description:
                specialStation.specialDescription
                ||
                'A featured stop selected for this journey.',

              tags:
                specialStation.specialTags
                ||
                [],

              name:
                specialStation.name,

              brand:
                specialStation.brand,

              kmMarker:
                Math.round(
                  specialStation.kmMarker
                  *
                  10
                )
                /
                10,

              distanceFromUser:
                Math.max(
                  0,
                  Math.round(
                    (
                      specialStation.kmMarker
                      -
                      currentPositionKm
                    )
                    *
                    10
                  )
                  /
                  10
                ),

              googleMapUrl:
                specialStation.googleMapUrl
            }
            :
            null;


        // =================================================
        // RESPONSE
        // =================================================

        return {
          estimatedRemainingRange:
            Math.round(
              remainingKmCapacity
              *
              10
            )
            /
            10,

          specialRecommendation,

          options
        };
      }
    )


    .listen(
      {
        port:
          PORT,

        hostname:
          '0.0.0.0'
      },

      server => {
        console.log(
          `🚀 Trip Fuel Planner is running at http://${server.hostname}:${server.port}`
        );
      }
    );