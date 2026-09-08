import { Elysia } from 'elysia';

// ดึง PORT จากระบบ Cloud (ถ้าเทสในคอมจะใช้ 3000 อัตโนมัติ)
const PORT = Number(process.env.PORT) || 3000;

const app = new Elysia()
  // 1. ส่งไฟล์หน้าเว็บหลัก (index.html)
  .get('/', () => Bun.file('index.html'))
  .get('/index.html', () => Bun.file('index.html'))

  // 2. API ดึงข้อมูลรถยนต์จากไฟล์ JSON ในโฟลเดอร์ data (ถ้ามี)
  .get('/api/cars', async () => {
    try {
      return await Bun.file('data/cars.json').json();
    } catch (error) {
      return { status: 'error', message: 'Cars data not found' };
    }
  })

  // 3. เริ่มรัน Server (ใส่ hostname 0.0.0.0 เพื่อให้ Cloud ปล่อยสัญญานออกอินเทอร์เน็ตได้)
  .listen({
    port: PORT,
    hostname: '0.0.0.0'
  }, (server) => {
    console.log(`🚀 Trip Fuel Planner is running at http://${server.hostname}:${server.port}`);
  });