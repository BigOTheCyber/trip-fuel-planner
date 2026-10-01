import { Elysia } from 'elysia';

const PORT = Number(process.env.PORT) || 3000;


// =========================================================
// CURATED SPECIAL STOPS
// =========================================================

const SPECIAL_STOPS = [

  {
    name: 'PT Gas Station Phan3 (Max Mart)',
    lat: 19.59981,
    lng: 99.74942,
    specialScore: 78,
    title: 'Convenient Route Stop',
    description:
      'A useful early-route stop with Max Mart for a quick break before continuing south.',
    tags: [
      'Max Mart',
      'Quick Break',
      'Convenience Stop'
    ]
  },

  {
    name: 'PT Gas Station Phayao (Punthai , Max Mart)',
    lat: 19.196,
    lng: 99.87598,
    specialScore: 88,
    title: 'Coffee & Convenience Stop',
    description:
      'A practical stop with Punthai Coffee and Max Mart, suitable for fuel and a longer break.',
    tags: [
      'Punthai Coffee',
      'Max Mart',
      'Route Break'
    ]
  },

  {
    name: 'PTT Station (Petrol+EV) Ngao',
    lat: 18.78519,
    lng: 99.96716,
    specialScore: 87,
    title: 'Featured Route Stop',
    description:
      'A useful stop along the Ngao section of the journey with fuel and EV support.',
    tags: [
      'EV Charging',
      'Route Break',
      'Featured Stop'
    ]
  },

  {
    name: 'PTT Station (With Jiffy)',
    lat: 15.02412,
    lng: 100.3389,
    specialScore: 84,
    title: 'Jiffy Travel Stop',
    description:
      'A convenient route stop with Jiffy facilities for a quick food, drink or rest break.',
    tags: [
      'Jiffy',
      'Food & Drinks',
      'Quick Break'
    ]
  },

  {
    name: 'PTT Station (Petrol+EV) (With Jiffy)',
    lat: 14.91608,
    lng: 100.402,
    specialScore: 91,
    title: 'Full-Service Travel Stop',
    description:
      'A useful travel stop combining fuel, EV support and Jiffy convenience facilities.',
    tags: [
      'Jiffy',
      'EV Charging',
      'Convenience Stop'
    ]
  },

  {
    name: 'PTT Station (With Jiffy)',
    lat: 14.55483,
    lng: 100.4988,
    specialScore: 86,
    title: 'Jiffy Route Break',
    description:
      'A convenient Jiffy stop positioned well for taking a break before continuing toward Ayutthaya.',
    tags: [
      'Jiffy',
      'Route Break',
      'Food & Drinks'
    ]
  },

  {
    name: 'PT Gas Station Nakhonloung4 (Max Mart)',
    lat: 14.40738,
    lng: 100.5828,
    specialScore: 82,
    title: 'Convenient Travel Stop',
    description:
      'A practical Max Mart stop for fuel, snacks and a short rest during the Ayutthaya section of the journey.',
    tags: [
      'Max Mart',
      'Convenience Stop',
      'Quick Break'
    ]
  },

  {
    name: 'PTT station - Active Park',
    lat: 13.91144,
    lng: 100.5424,
    specialScore: 98,
    title: 'Premium Rest Stop',
    description:
      'A larger rest-stop style station suited to a proper break near Bangkok.',
    tags: [
      'Restaurants',
      'Cafés',
      'Large Rest Stop'
    ]
  },

  {
    name: 'PTT Rest Area',
    lat: 13.84075,
    lng: 100.534,
    specialScore: 93,
    title: 'Dedicated Rest Stop',
    description:
      'A dedicated rest-area style stop suited to taking a proper break near the final section of the journey.',
    tags: [
      'Rest Area',
      'Traveller Stop',
      'Long Break'
    ]
  }

];



// =========================================================
// HELPERS
// =========================================================

function normalizeText(value: any) {

  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

}



function coordinateIsClose(
  valueA: number,
  valueB: number,
  tolerance = 0.003
) {

  return (
    Math.abs(
      Number(valueA) - Number(valueB)
    )
    <=
    tolerance
  );

}



// =========================================================
// CSV PARSER
// =========================================================

function parseCSVLine(line: string) {

  const values: string[] = [];

  let current = '';
  let insideQuotes = false;


  for (
    let i = 0;
    i < line.length;
    i++
  ) {

    const char = line[i];


    if (char === '"') {

      if (
        insideQuotes
        &&
        line[i + 1] === '"'
      ) {

        current += '"';
        i++;

      } else {

        insideQuotes = !insideQuotes;

      }


    } else if (
      char === ','
      &&
      !insideQuotes
    ) {

      values.push(
        current.trim()
      );

      current = '';


    } else {

      current += char;

    }

  }


  values.push(
    current.trim()
  );


  return values;

}



// =========================================================
// SPECIAL STOP MATCHING
// =========================================================

function getSpecialStop(
  stationName: string,
  stationLat: number,
  stationLng: number
) {

  const normalizedStationName =
    normalizeText(stationName);


  return SPECIAL_STOPS.find(
    special => {

      const nameMatches =
        normalizeText(special.name)
        ===
        normalizedStationName;


      if (!nameMatches) {
        return false;
      }


      return (
        coordinateIsClose(
          stationLat,
          special.lat
        )
        &&
        coordinateIsClose(
          stationLng,
          special.lng
        )
      );

    }
  );

}



// =========================================================
// BRAND MATCHING
// =========================================================

function getCanonicalBrand(
  brand: string
) {

  const value =
    normalizeText(brand);


  if (
    value.includes('ptt')
    ||
    value.includes('ปตท')
  ) {

    return 'PTT';

  }


  if (
    value.startsWith('pt ')
    ||
    value === 'pt'
    ||
    value.includes('พีที')
  ) {

    return 'PT';

  }


  if (
    value.includes('bangchak')
    ||
    value.includes('บางจาก')
  ) {

    return 'Bangchak';

  }


  if (
    value.includes('shell')
    ||
    value.includes('เชลล์')
  ) {

    return 'Shell';

  }


  if (
    value.includes('caltex')
    ||
    value.includes('คาลเท็กซ์')
  ) {

    return 'Caltex';

  }


  if (
    value.includes('susco')
    ||
    value.includes('ซัสโก้')
  ) {

    return 'Susco';

  }


  if (
    value.includes('cosmo')
    ||
    value.includes('คอสโม')
  ) {

    return 'Cosmo';

  }


  return brand || 'Other';

}



function stationMatchesPreferredBrand(
  station: any,
  preferredBrands: string[]
) {

  if (
    !Array.isArray(preferredBrands)
    ||
    preferredBrands.length === 0
  ) {

    return false;

  }


  const stationBrand =
    getCanonicalBrand(
      station.brand
    );


  return preferredBrands.some(
    brand =>
      normalizeText(brand)
      ===
      normalizeText(stationBrand)
  );

}



// =========================================================
// STATION CSV
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
        .map(
          line =>
            line.trim()
        )
        .filter(
          line =>
            line.length > 0
        );


    if (
      lines.length <= 1
    ) {

      return [];

    }


    const headers =
      parseCSVLine(
        lines[0]
      );


    let accumulatedKm = 0;


    return lines
      .slice(1)
      .map(
        (
          line,
          index
        ) => {

          const values =
            parseCSVLine(
              line
            );


          const row: any = {};


          headers.forEach(
            (
              header,
              i
            ) => {

              row[header] =
                values[i]
                ||
                '';

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
              row[
                'ห่างจากปั๊มก่อนหน้า (KM)'
              ]
              ||
              '0'
            )
            ||
            0;


          accumulatedKm +=
            distFromPrev;


          const special =
            getSpecialStop(
              name,
              lat,
              lng
            );


          return {

            id:
              `station-${index}`,

            name,

            brand,

            canonicalBrand:
              getCanonicalBrand(
                brand
              ),

            lat,

            lng,

            googleMapUrl:
              mapUrl
              ||
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,

            kmMarker:
              accumulatedKm,

            isSpecial:
              Boolean(
                special
              ),

            specialScore:
              special
                ?
                special.specialScore
                :
                0,

            specialTitle:
              special
                ?
                special.title
                :
                '',

            specialDescription:
              special
                ?
                special.description
                :
                '',

            specialTags:
              special
                ?
                special.tags
                :
                []

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
      () =>
        Bun.file(
          'index.html'
        )
    )



    .get(
      '/index.html',
      () =>
        Bun.file(
          'index.html'
        )
    )



    // =====================================================
    // CARS
    // =====================================================

    .get(
      '/api/cars',

      async () => {

        try {

          return await Bun.file(
            'data/cars.json'
          ).json();


        } catch (error) {

          return {

            status: 'error',

            message:
              'Cars data not found'

          };

        }

      }
    )



    // =====================================================
    // STATIONS
    // =====================================================

    .get(
      '/api/stations',

      async () => {

        return await getStationsFromCSV();

      }
    )



    // =====================================================
    // PLAN TRIP
    // =====================================================

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

          selectedBrands = [],

          currentKm = 0

        } =
          body || {};



        // =================================================
        // CAR
        // =================================================

        let cars: any[] = [];


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

          cars = [];

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

            tankCapacity: 45,

            fuelEfficiency: 15

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



        // =================================================
        // RANGE
        // =================================================

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



        const maximumReachKm =
          currentPositionKm
          +
          remainingKmCapacity;



        const reachableStations =
          stationsAhead.filter(
            station =>
              station.kmMarker
              <=
              maximumReachKm
          );



        if (
          reachableStations.length
          ===
          0
        ) {

          return {

            estimatedRemainingRange:
              Math.round(
                remainingKmCapacity
                *
                10
              )
              /
              10,

            specialRecommendation:
              null,

            options:
              []

          };

        }



        const cleanPreferredBrands =
          Array.isArray(
            selectedBrands
          )
            ?
            selectedBrands
            :
            [];



        // =================================================
        // HELPERS
        // =================================================

        function getPreferredPool(
          stationsToCheck: any[]
        ) {

          if (
            cleanPreferredBrands.length
            ===
            0
          ) {

            return stationsToCheck;

          }


          const preferred =
            stationsToCheck.filter(
              station =>
                stationMatchesPreferredBrand(
                  station,
                  cleanPreferredBrands
                )
            );


          // Preferred brand is only a preference.
          // If none are available, fall back safely.

          return preferred.length > 0
            ?
            preferred
            :
            stationsToCheck;

        }



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


          const possibleStations =
            reachableStations.filter(
              station =>

                station.kmMarker
                <=
                maxKm

                &&

                !excludedIds.includes(
                  station.id
                )
            );


          const preferredPool =
            getPreferredPool(
              possibleStations
            );


          if (
            preferredPool.length
            ===
            0
          ) {

            return null;

          }


          return preferredPool[
            preferredPool.length - 1
          ];

        }



        function buildReasonTags(
          station: any,
          type: string
        ) {

          const tags: string[] =
            [];


          if (
            type === 'soon'
          ) {

            tags.push(
              'Nearest'
            );

          }


          if (
            type === 'recommended'
          ) {

            tags.push(
              'Safer Reserve'
            );

          }


          if (
            type === 'relaxed'
          ) {

            tags.push(
              'Farther Stop'
            );

          }


          if (
            station
            &&
            cleanPreferredBrands.length > 0
            &&
            stationMatchesPreferredBrand(
              station,
              cleanPreferredBrands
            )
          ) {

            tags.push(
              'Preferred Brand'
            );

          }


          return tags;

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

            reasonTags:
              buildReasonTags(
                station,
                type
              ),

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
        // SAFETY RATIO
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
        // REFUEL SOON
        // =================================================
        //
        // Safety takes priority here.
        // Always use nearest reachable station,
        // regardless of preferred brand.
        //

        const soonStation =
          reachableStations[0]
          ||
          null;



        // =================================================
        // RECOMMENDED
        // =================================================

        let recommendedStation =
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



        if (
          !recommendedStation
        ) {

          const alternatives =
            reachableStations.filter(
              station =>
                station.id
                !==
                soonStation?.id
            );


          const pool =
            getPreferredPool(
              alternatives
            );


          recommendedStation =
            pool[0]
            ||
            null;

        }



        // =================================================
        // RELAXED
        // =================================================

        const excludedIds: string[] =
          [];


        if (
          soonStation?.id
        ) {

          excludedIds.push(
            soonStation.id
          );

        }


        if (
          recommendedStation?.id
        ) {

          excludedIds.push(
            recommendedStation.id
          );

        }



        let relaxedStation =
          getFurthestStationWithin(
            0.92,
            excludedIds
          );



        if (
          !relaxedStation
        ) {

          const remainingChoices =
            reachableStations.filter(
              station =>
                !excludedIds.includes(
                  station.id
                )
            );


          const pool =
            getPreferredPool(
              remainingChoices
            );


          relaxedStation =
            pool.length > 0
              ?
              pool[
                pool.length - 1
              ]
              :
              null;

        }



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
            'A safer stop with extra reserve for traffic, delays or unexpected conditions.';

        }



        const options =
          [

            formatStation(
              soonStation,
              'soon',
              'Refuel Soon',
              'The nearest reachable fuel station ahead.'
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
          .filter(
            Boolean
          );



        // =================================================
        // SPECIAL PICK
        // =================================================

        let idealSpecialRatio =
          0.75;


        if (
          Number(fuelLevel)
          ===
          1
        ) {

          idealSpecialRatio =
            0.28;


        } else if (
          Number(fuelLevel)
          ===
          2
        ) {

          idealSpecialRatio =
            0.42;


        } else if (
          Number(fuelLevel)
          ===
          3
        ) {

          idealSpecialRatio =
            0.56;


        } else if (
          Number(fuelLevel)
          ===
          4
        ) {

          idealSpecialRatio =
            0.67;

        }



        const idealSpecialKm =
          currentPositionKm
          +
          (
            remainingKmCapacity
            *
            idealSpecialRatio
          );



        const specialSafeMaxKm =
          currentPositionKm
          +
          (
            remainingKmCapacity
            *
            recommendedRatio
          );



        let minimumSpecialDistance =
          remainingKmCapacity
          *
          0.16;


        if (
          Number(fuelLevel)
          ===
          1
        ) {

          minimumSpecialDistance =
            5;

        }


        minimumSpecialDistance =
          Math.max(
            5,
            minimumSpecialDistance
          );



        const specialMinimumKm =
          currentPositionKm
          +
          minimumSpecialDistance;



        const allowedTargetDifference =
          Math.max(

            45,

            remainingKmCapacity
            *
            0.22

          );



        const specialCandidates =
          reachableStations

            .filter(
              station =>

                station.isSpecial

                &&

                station.kmMarker
                >=
                specialMinimumKm

                &&

                station.kmMarker
                <=
                specialSafeMaxKm
            )

            .map(
              station => {

                const targetDifference =
                  Math.abs(
                    station.kmMarker
                    -
                    idealSpecialKm
                  );


                const qualityBonus =
                  Math.max(

                    0,

                    (
                      station.specialScore
                      -
                      70
                    )
                    /
                    30
                    *
                    18

                  );


                const preferredBrandBonus =
                  (
                    cleanPreferredBrands.length > 0
                    &&
                    stationMatchesPreferredBrand(
                      station,
                      cleanPreferredBrands
                    )
                  )
                    ?
                    8
                    :
                    0;


                const selectionValue =
                  targetDifference
                  -
                  qualityBonus
                  -
                  preferredBrandBonus;


                return {

                  station,

                  targetDifference,

                  selectionValue

                };

              }
            )

            .filter(
              candidate =>
                candidate.targetDifference
                <=
                allowedTargetDifference
            )

            .sort(
              (
                a,
                b
              ) => {

                if (
                  Math.abs(
                    a.selectionValue
                    -
                    b.selectionValue
                  )
                  >
                  2
                ) {

                  return (
                    a.selectionValue
                    -
                    b.selectionValue
                  );

                }


                if (
                  b.station.specialScore
                  !==
                  a.station.specialScore
                ) {

                  return (
                    b.station.specialScore
                    -
                    a.station.specialScore
                  );

                }


                return (
                  b.station.kmMarker
                  -
                  a.station.kmMarker
                );

              }
            );



        const specialStation =
          specialCandidates.length > 0
            ?
            specialCandidates[0].station
            :
            null;



        let specialTags: string[] =
          specialStation
            ?
            [
              ...specialStation.specialTags
            ]
            :
            [];


        if (
          specialStation
          &&
          cleanPreferredBrands.length > 0
          &&
          stationMatchesPreferredBrand(
            specialStation,
            cleanPreferredBrands
          )
        ) {

          specialTags.push(
            'Preferred Brand'
          );

        }



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
                specialTags,

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