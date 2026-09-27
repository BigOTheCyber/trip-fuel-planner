import carsData from "./data/cars.json";

interface Car {
  id: string;
  brand: string;
  model: string;
  tankSize: number;
  kmPerLiter: number;
}

interface Station {
  id: string;
  name: string;
  brand: string;
  lat: number;
  lng: number;
  googleMapsUrl: string;
  distanceKm: number;
}

// ฟังก์ชันอ่านและ Parse ไฟล์ CSV แบบ Async สำหรับ Bun
async function loadStations(): Promise<Station[]> {
  try {
    const file = Bun.file("./data/stations.csv");
    const text = await file.text();
    const lines = text.trim().split("\n");
    if (lines.length <= 1) return [];

    const headers = lines[0].split(",").map((h) => h.trim());

    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const stationObj: Record<string, string> = {};
      headers.forEach((header, index) => {
        stationObj[header] = values[index] || "";
      });

      return {
        id: stationObj.id || "",
        name: stationObj.name || "",
        brand: stationObj.brand || "",
        lat: parseFloat(stationObj.lat) || 0,
        lng: parseFloat(stationObj.lng) || 0,
        googleMapsUrl: stationObj.googleMapsUrl || "",
        distanceKm: parseFloat(stationObj.distanceKm) || 0,
      };
    });
  } catch (error) {
    console.error("Error reading stations.csv:", error);
    return [];
  }
}

const cars: Car[] = carsData as Car[];

// เปิด Web Server ด้วย Bun.serve เพื่อรันค้างบน Render
const server = Bun.serve({
  port: process.env.PORT || 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=utf-8",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Endpoint: ดึงรายชื่อรถทั้งหมด
    if (url.pathname === "/api/cars") {
      return new Response(JSON.stringify(cars), { headers: corsHeaders });
    }

    // Endpoint: ดึงรายชื่อปั๊มทั้งหมด
    if (url.pathname === "/api/stations") {
      const stations = await loadStations();
      return new Response(JSON.stringify(stations), { headers: corsHeaders });
    }

    // Endpoint: คำนวณและแนะนำจุดแวะเติมน้ำมัน
    if (url.pathname === "/api/plan-trip") {
      const carId = url.searchParams.get("carId");
      const currentDistanceKm = parseFloat(url.searchParams.get("currentDistanceKm") || "0");

      if (!carId) {
        return new Response(JSON.stringify({ error: "Missing carId parameter" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const car = cars.find((c) => c.id === carId);
      if (!car) {
        return new Response(JSON.stringify({ error: "Car not found" }), {
          status: 404,
          headers: corsHeaders,
        });
      }

      const stations = await loadStations();

      // คำนวณระยะทางและ Safe Range (เผื่อความปลอดภัย 15%)
      const maxRangeTheoretical = car.tankSize * car.kmPerLiter;
      const safeRange = maxRangeTheoretical * 0.85;

      // คัดเฉพาะปั๊มที่อยู่ข้างหน้าและยังไม่เกิน Safe Range
      const reachableStations = stations
        .filter((station) => {
          const distanceAhead = station.distanceKm - currentDistanceKm;
          return distanceAhead > 0 && distanceAhead <= safeRange;
        })
        .sort((a, b) => a.distanceKm - b.distanceKm);

      if (reachableStations.length === 0) {
        return new Response(
          JSON.stringify({
            message: "ไม่พบปั๊มน้ำมันในระยะปลอดภัย กรุณาเตรียมตัวเติมน้ำมันล่วงหน้า",
            safeRange: Math.round(safeRange),
            maxRangeTheoretical: Math.round(maxRangeTheoretical),
          }),
          { headers: corsHeaders }
        );
      }

      // เลือก 3 ปั๊มตามระดับความรีบด่วน
      const count = reachableStations.length;
      const redStation = reachableStations[0]; // ปั๊มแรกสุด (Panic mode)
      const yellowStation = reachableStations[Math.floor(count / 2)]; // ปั๊มระยะกลาง
      const greenStation = reachableStations[count - 1]; // ปั๊มไกลสุดในระยะ Safe Range

      const result = {
        carInfo: car,
        maxRangeTheoretical: Math.round(maxRangeTheoretical),
        safeRange: Math.round(safeRange),
        currentDistanceKm,
        recommendations: [
          {
            level: "RED",
            colorCode: "#FF4D4F",
            title: "🔴 รีบที่สุด (Panic Mode)",
            description: "สำหรับคนกังวล แวะเติมทันทีตั้งแต่เนิ่นๆ ในระยะแรกที่เจอ",
            station: redStation,
            distanceFromCurrentKm: Math.round(redStation.distanceKm - currentDistanceKm),
          },
          {
            level: "YELLOW",
            colorCode: "#FAAD14",
            title: "🟡 รีบกลาง (ระยะกำลังดี)",
            description: "จุดแวะมาตรฐาน ระยะทางพอดีๆ ไม่เร็วและไม่ช้าเกินไป",
            station: yellowStation,
            distanceFromCurrentKm: Math.round(yellowStation.distanceKm - currentDistanceKm),
          },
          {
            level: "GREEN",
            colorCode: "#52C41A",
            title: "🟢 รีบน้อย (ชิลๆ ลากยาวได้)",
            description: "วิ่งต่อได้ไกลที่สุดก่อนเข้าเขตน้ำมันสำรอง เน้นขับยาวๆ",
            station: greenStation,
            distanceFromCurrentKm: Math.round(greenStation.distanceKm - currentDistanceKm),
          },
        ],
      };

      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Endpoint not found" }), {
      status: 404,
      headers: corsHeaders,
    });
  },
});

console.log(`Server is running on port ${server.port}`);