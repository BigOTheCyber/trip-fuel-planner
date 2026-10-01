import { Elysia } from 'elysia';

const PORT = Number(process.env.PORT) || 3000;


// =========================================================
// CURATED SPECIAL STOPS
// =========================================================
//
// Special Pick rules:
//
// 1. Must match one EXACT branch.
// 2. Must be ahead of the driver.
// 3. Must be inside the safe recommended range.
// 4. If several are reachable, highest specialScore wins.
//
// Popularity/facilities NEVER override fuel safety.
//

const SPECIAL_STOPS = [

  // =======================================================
  // CHIANG RAI — PHAN
  // =======================================================

  {
    name:
      'PT Gas Station Phan3 (Max Mart)',

    lat:
      19.59981,

    lng:
      99.74942,

    specialScore:
      78,

    title:
      'Convenient Route Stop',

    description:
      'A useful early-route stop with Max Mart for a quick break before continuing south.',

    tags: [
      'Max Mart',
      'Quick Break',
      'Convenience Stop'
    ]
  },


  // =======================================================
  // PHAYAO
  // =======================================================

  {
    name:
      'PT Gas Station Phayao (Punthai , Max Mart)',

    lat:
      19.196,

    lng:
      99.87598,

    specialScore:
      88,

    title:
      'Coffee & Convenience Stop',

    description:
      'A practical 24-hour stop with Punthai Coffee and Max Mart, suitable for fuel and a longer break.',

    tags: [
      'Punthai Coffee',
      'Max Mart',
      '24/7'
    ]
  },


  // =======================================================
  // NGAO
  // =======================================================
  //
  // IMPORTANT:
  // ONLY this exact branch is special.
  // Other stations containing "Ngao" are NOT automatically
  // selected.
  //

  {
    name:
      'PTT Station (Petrol+EV) Ngao',

    lat:
      18.78519,

    lng:
      99.96716,

    specialScore:
      87,

    title:
      'Featured Route Stop',

    description:
      'A useful stop along the Ngao section of the journey with fuel and EV support.',

    tags: [
      'EV Charging',
      'Route Break',
      'Featured Stop'
    ]
  },


  // =======================================================
  // LOWER NORTH / CENTRAL ROUTE
  // =======================================================

  {
    name:
      'PTT Station (With Jiffy)',

    lat:
      15.02412,

    lng:
      100.3389,

    specialScore:
      84,

    title:
      'Jiffy Travel Stop',

    description:
      'A convenient route stop with Jiffy facilities for a quick food, drink or rest break.',

    tags: [
      'Jiffy',
      'Food & Drinks',
      'Quick Break'
    ]
  },


  {
    name:
      'PTT Station (Petrol+EV) (With Jiffy)',

    lat:
      14.91608,

    lng:
      100.402,

    specialScore:
      91,

    title:
      'Full-Service Travel Stop',

    description:
      'A useful travel stop combining fuel, EV support and Jiffy convenience facilities.',

    tags: [
      'Jiffy',
      'EV Charging',
      'Convenience Stop'
    ]
  },


  {
    name:
      'PTT Station (With Jiffy)',

    lat:
      14.55483,

    lng:
      100.4988,

    specialScore:
      86,

    title:
      'Jiffy Route Break',

    description:
      'A convenient Jiffy stop positioned well for taking a break before continuing toward Ayutthaya.',

    tags: [
      'Jiffy',
      'Route Break',
      'Food & Drinks'
    ]
  },


  // =======================================================
  // AYUTTHAYA — NAKHON LUANG
  // =======================================================

  {
    name:
      'PT Gas Station Nakhonloung4 (Max Mart)',

    lat:
      14.40738,

    lng:
      100.5828,

    specialScore:
      82,

    title:
      'Convenient Travel Stop',

    description:
      'A practical Max Mart stop for fuel, snacks and a short rest during the Ayutthaya section of the journey.',

    tags: [
      'Max Mart',
      'Convenience Stop',
      'Quick Break'
    ]
  },


  // =======================================================
  // NONTHABURI / MUANG THONG
  // =======================================================

  {
    name:
      'PTT station - Active Park',

    lat:
      13.91144,

    lng:
      100.5424,

    specialScore:
      98,

    title:
      'Premium Rest Stop',

    description:
      'A larger rest-stop style station with multiple restaurants and cafés, suited to a proper break near Bangkok.',

    tags: [
      'Restaurants',
      'Cafés',
      'Large Rest Stop'
    ]
  },


  // =======================================================
  // BANGKOK
  // =======================================================

  {
    name:
      'PTT Rest Area',

    lat:
      13.84075,

    lng:
      100.534,

    specialScore:
      93,

    title:
      'Dedicated Rest Stop',

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
// TEXT HELPERS
// =========================================================

function normalizeText(value: any) {

  return String(
    value || ''
  )
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
      Number(valueA)
      -
      Number(valueB)
    )
    <=
    tolerance
  );

}



// =========================================================
// SAFE CSV PARSER
// =========================================================
//
// The old version used:
//
// line.split(',')
//
// That breaks fields such as:
//
// "PT Gas Station Phayao (Punthai , Max Mart)"
//
// because the comma inside the station name was treated as
// another column.
//
// This parser respects quoted CSV values.
//

function parseCSVLine(line: string) {

  const values: string[] =
    [];

  let current =
    '';

  let insideQuotes =
    false;


  for (
    let i = 0;
    i < line.length;
    i++
  ) {

    const char =
      line[i];


    if (
      char === '"'
    ) {

      // Handle escaped quote ""
      if (
        insideQuotes
        &&
        line[i + 1] === '"'
      ) {

        current +=
          '"';

        i++;

      } else {

        insideQuotes =
          !insideQuotes;

      }


    } else if (
      char === ','
      &&
      !insideQuotes
    ) {

      values.push(
        current.trim()
      );

      current =
        '';


    } else {

      current +=
        char;

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
    normalizeText(
      stationName
    );


  return SPECIAL_STOPS.find(
    special => {

      const nameMatches =
        normalizeText(
          special.name
        )
        ===
        normalizedStationName;


      if (
        !nameMatches
      ) {

        return false;

      }


      const latitudeMatches =
        coordinateIsClose(
          stationLat,
          special.lat
        );


      const longitudeMatches =
        coordinateIsClose(
          stationLng,
          special.lng
        );


      return (
        latitudeMatches
        &&
        longitudeMatches
      );

    }
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


    let accumulatedKm =
      0;


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


          const row: any =
            {};


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


          // ===============================================
          // BASIC STATION DATA
          // ===============================================

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



          // ===============================================
          // EXACT SPECIAL BRANCH CHECK
          // ===============================================

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

            lat,

            lng,


            googleMapUrl:
              mapUrl
              ||
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,


            kmMarker:
              accumulatedKm,


            // =============================================
            // SPECIAL PICK INFORMATION
            // =============================================

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



    // =====================================================
    // FRONTEND
    // =====================================================

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



    // =====================================================
    // CARS API
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

            status:
              'error',

            message:
              'Cars data not found'

          };

        }

      }
    )



    // =====================================================
    // STATIONS API
    // =====================================================

    .get(
      '/api/stations',

      async () => {

        return await getStationsFromCSV();

      }
    )



    // =====================================================
    // PLAN TRIP API
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

          currentKm = 0

        } =
          body || {};



        // =================================================
        // LOAD CAR DATA
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
              String(
                car.id
              )
              ===
              String(
                carId
              )
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



        // =================================================
        // VEHICLE RANGE
        // =================================================

        const fullRange =
          tankCapacity
          *
          fuelEfficiency;



        const currentFuelRatio =
          Math.min(

            Math.max(

              Number(
                fuelLevel
              )
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
          Number(
            currentKm
          )
          ||
          0;



        // =================================================
        // LOAD ROUTE STATIONS
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



        // =================================================
        // REACHABLE STATIONS
        // =================================================
        //
        // Never suggest a station outside the vehicle's
        // estimated remaining range.
        //

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



        // =================================================
        // NO REACHABLE STATIONS
        // =================================================

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



        // =================================================
        // HELPERS
        // =================================================

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
        // SAFETY RATIO
        // =================================================

        let recommendedRatio =
          0.85;



        if (
          Number(
            fuelLevel
          )
          ===
          1
        ) {

          recommendedRatio =
            0.45;


        } else if (
          Number(
            fuelLevel
          )
          ===
          2
        ) {

          recommendedRatio =
            0.60;


        } else if (
          Number(
            fuelLevel
          )
          ===
          3
        ) {

          recommendedRatio =
            0.70;


        } else if (
          Number(
            fuelLevel
          )
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
          reachableStations.length > 0
            ?
            reachableStations[0]
            :
            null;



        // =================================================
        // OPTION 2 — RECOMMENDED
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



        // If the safe window contains only the nearest
        // station, use the next reachable station instead.

        if (
          !recommendedStation
        ) {

          recommendedStation =
            reachableStations.find(
              station => {

                if (
                  !soonStation
                ) {

                  return true;

                }


                return (
                  station.id
                  !==
                  soonStation.id
                );

              }
            )
            ||
            null;

        }



        // =================================================
        // OPTION 3 — RELAXED
        // =================================================

        const excludedIds: string[] =
          [];


        if (
          soonStation
          &&
          soonStation.id
        ) {

          excludedIds.push(
            soonStation.id
          );

        }


        if (
          recommendedStation
          &&
          recommendedStation.id
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



        // If there is no distinct station inside the 92%
        // window, choose the furthest remaining reachable
        // station without duplicating another option.

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


          if (
            remainingChoices.length > 0
          ) {

            relaxedStation =
              remainingChoices[
                remainingChoices.length
                -
                1
              ];

          }

        }



        // =================================================
        // RECOMMENDED DESCRIPTION
        // =================================================

        let recommendedDescription =
          'A balanced fuel stop with a comfortable safety reserve.';



        if (
          Number(
            fuelLevel
          )
          ===
          1
        ) {

          recommendedDescription =
            'Low fuel detected. A closer stop is recommended for a larger safety reserve.';


        } else if (
          Number(
            fuelLevel
          )
          ===
          2
        ) {

          recommendedDescription =
            'Fuel is running low, so a closer stop is recommended for extra safety.';


        } else if (
          Number(
            fuelLevel
          )
          ===
          3
        ) {

          recommendedDescription =
            'A safer stop with extra reserve for traffic, delays, or unexpected conditions.';

        }



        // =================================================
        // NORMAL RESULT CARDS
        // =================================================

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
        //
        // Special Pick uses the SAME safe window as the
        // normal Recommended option.
        //
        // A high specialScore can NEVER make an unsafe
        // station appear.
        //

        const specialSafeMaxKm =
          currentPositionKm
          +
          (
            remainingKmCapacity
            *
            recommendedRatio
          );



        const safeSpecialStations =
          reachableStations

            .filter(
              station =>

                station.isSpecial

                &&

                station.kmMarker
                <=
                specialSafeMaxKm

            )

            .sort(
              (
                a,
                b
              ) => {


                // -----------------------------------------
                // 1. Higher curated score first
                // -----------------------------------------

                if (
                  b.specialScore
                  !==
                  a.specialScore
                ) {

                  return (
                    b.specialScore
                    -
                    a.specialScore
                  );

                }


                // -----------------------------------------
                // 2. If scores are equal,
                //    prefer the farther useful stop
                // -----------------------------------------

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



    // =====================================================
    // START SERVER
    // =====================================================

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