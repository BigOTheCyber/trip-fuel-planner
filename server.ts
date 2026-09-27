import { Serve } from "bun"; // หรือ express ตามโครงสร้างเดิมของคุณ
import cars from "./data/cars.json";
import stations from "./data/stations.csv"; // สมมติว่ามี loader/parser csv หรือ json array

// Interfaces
interface Car {
  id: string;
  brand: string;
  model: string;
  tankSize: number; // ลิตร
  kmPerLiter: number; // km/L
}

interface Station {
  id: string;
  name: string;
  brand: string;
  lat: number;
  lng: number;
  googleMapsUrl: string;
  distanceKm: number; // ระยะทางจากจุดเริ่มต้น (เชียงราย)
}

// Logic คำนวณจุดแวะเติมน้ำมัน
export function planTrip(carId: string, currentDistanceKm: number = 0) {
  const car = cars.find((c) => c.id === carId);
  if (!car) throw new Error("Car not found");

  // 1. คำนวณระยะทางสูงสุดจริง และ Safe Range (หัก Safety Reserve 15%)
  const maxRangeTheoretical = car.tankSize * car.kmPerLiter;
  const safeRange = maxRangeTheoretical * 0.85;

  // 2. ค้นหาปั๊มทั้งหมดบนเส้นทางที่อยู่ภายในระยะ Safe Range จากจุดปัจจุบัน
  const reachableStations = stations
    .filter((station) => {
      const distanceAhead = station.distanceKm - currentDistanceKm;
      return distanceAhead > 0 && distanceAhead <= safeRange;
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (reachableStations.length === 0) {
    return {
      error: "ไม่พบปั๊มน้ำมันในระยะปลอดภัย กรุณาเตรียมตัวเติมน้ำมันล่วงหน้า",
      safeRange,
    };
  }

  // 3. คัดเลือก 3 ปั๊ม 3 สี (🔴 Red / 🟡 Yellow / 🟢 Green)
  const count = reachableStations.length;
  let redStation: Station;
  let yellowStation: Station;
  let greenStation: Station;

  if (count === 1) {
    redStation = yellowStation = greenStation = reachableStations[0];
  } else if (count === 2) {
    redStation = reachableStations[0];
    yellowStation = reachableStations[0];
    greenStation = reachableStations[1];
  } else {
    // 🔴 Red: ปั๊มแรกๆ ช่วงต้น (Panic Mode / รีบเติมทันที)
    redStation = reachableStations[0];

    // 🟡 Yellow: ปั๊มช่วงกลางๆ (ระยะกำลังเหมาะสม)
    const midIndex = Math.floor(count / 2);
    yellowStation = reachableStations[midIndex];

    // 🟢 Green: ปั๊มไกลสุดในระยะปลอดภัย (ชิลๆ ลากยาวได้)
    greenStation = reachableStations[count - 1];
  }

  return {
    carInfo: car,
    maxRangeTheoretical: Math.round(maxRangeTheoretical),
    safeRange: Math.round(safeRange),
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
}