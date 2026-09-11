import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// ฟังก์ชันค้นหาไฟล์อัตโนมัติ (รองรับทั้งอยู่ใน data/ และโฟลเดอร์หลัก)
function resolveFilePath(filename: string): string {
  const inDataFolder = path.join(__dirname, 'data', filename);
  if (fs.existsSync(inDataFolder)) return inDataFolder;
  return path.join(__dirname, filename);
}

// โหลดข้อมูลแบบปลอดภัย ไม่ค้างแม้เปลี่ยนที่เก็บไฟล์
const carsPath = resolveFilePath('cars.json');
const carsData = fs.existsSync(carsPath) 
  ? JSON.parse(fs.readFileSync(carsPath, 'utf-8')) 
  : [];

const stationsPath = resolveFilePath('stations.json');
const stationsData = fs.existsSync(stationsPath) 
  ? JSON.parse(fs.readFileSync(stationsPath, 'utf-8')) 
  : [];

// API Routes
app.get('/api/cars', (req, res) => res.json(carsData));
app.get('/api/stations', (req, res) => res.json(stationsData));

// Serve Index HTML
app.get('*', (req, res) => {
  const indexPath = resolveFilePath('index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('index.html not found');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});