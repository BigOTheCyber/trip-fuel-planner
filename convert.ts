import { readFileSync, writeFileSync } from 'fs'

// 1. อ่านไฟล์ CSV
const csvData = readFileSync('./data/stations.csv', 'utf-8')
const lines = csvData.split('\n')

let cumulativeKm = 0

// 2. แปลงแต่ละบรรทัดให้เป็น JSON
const stations = lines.slice(1).map((line, index) => {
  const cols = line.split(',')
  
  if (cols.length < 6) return null

  const name = cols[0]?.trim()
  const brand = cols[1]?.trim()
  const lat = parseFloat(cols[2])
  const lng = parseFloat(cols[3])
  const googleMapUrl = cols[4]?.trim()
  const distFromPrev = parseFloat(cols[5]) || 0

  // คำนวณระยะทางสะสม (Cumulative KM) จากเชียงราย
  cumulativeKm += distFromPrev

  return {
    id: index + 1,
    name,
    brand,
    lat,
    lng,
    googleMapUrl,
    distFromPrev,
    kmMarker: Number(cumulativeKm.toFixed(2))
  }
}).filter(Boolean)

// 3. บันทึกผลลัพธ์เป็นไฟล์ stations.json ไว้ในโฟลเดอร์ data
writeFileSync('./data/stations.json', JSON.stringify(stations, null, 2))
console.log(`✅ แปลงข้อมูลสำเร็จ! ได้ปั๊มน้ำมันทั้งหมด ${stations.length} ปั๊ม`)