# Electrical Work Planning — Phase 1

เว็บแอปปฏิทินแผนงานด้านไฟฟ้า สำหรับพนักงานไม่เกิน 30 คน

## Stack
- Next.js App Router + TypeScript
- Supabase Auth + PostgreSQL + Row Level Security
- Supabase Realtime
- FullCalendar
- Vercel (hosting)

## ฟังก์ชันในโครงสร้างเริ่มต้น
- Login ด้วยรหัสพนักงาน + password
- Employee และ Admin
- ปฏิทินเดือน / สัปดาห์ / วัน
- เพิ่มและแก้ไขแผนงาน
- พนักงานแก้ไขงานที่ตัวเองสร้างได้
- Admin แก้ไขและลบทุกแผนงานได้
- แสดงแผนงานแบบ real-time
- เลือกผู้ควบคุมและสมาชิกงานได้หลายคน

## 1) เตรียม Supabase
1. สร้าง Project ใหม่ใน Supabase
2. ไปที่ SQL Editor แล้วรันไฟล์ `supabase/migrations/001_initial_schema.sql`
3. ไปที่ Project Settings > API แล้วคัดลอก Project URL และ anon/public key
4. เปิด Realtime ให้ตาราง `work_plans` และ `work_plan_members` (migration จะเพิ่ม publication ให้แล้ว)
5. ตรวจสอบว่า RLS เปิดอยู่ตาม migration

## 2) ติดตั้งโปรเจกต์
```bash
npm install
cp .env.example .env.local
```
ใส่ค่า:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

จากนั้น:
```bash
npm run dev
```
เปิด http://localhost:3000

## 3) สร้างบัญชี Admin คนแรก
ใช้ Service Role Key เฉพาะบนเครื่องผู้ดูแลระบบ ห้ามใส่ใน `NEXT_PUBLIC_` และห้าม commit ลง Git

ติดตั้ง dependency แล้วตั้ง environment:
```bash
export SUPABASE_URL=https://YOUR_PROJECT.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

สร้างบัญชี:
```bash
node scripts/create-employee.mjs ADMIN01 "System Administrator" "ChangeThisPassword!" admin
```

สร้างบัญชีพนักงาน:
```bash
node scripts/create-employee.mjs E001 "Employee One" "TemporaryPassword!" employee
```

บัญชีใช้ email ภายในรูปแบบ `รหัสพนักงาน@login.electrical.local` แต่ผู้ใช้กรอกเพียงรหัสพนักงานบนหน้า Login

## 4) Deploy บน Vercel
1. Push โปรเจกต์ขึ้น GitHub (อย่า push `.env.local`)
2. Import repository ใน Vercel
3. เพิ่ม Environment Variables 2 ค่า: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

## กติกาสิทธิ์ใน Phase 1
- ผู้ใช้ที่ Login แล้วทุกคนอ่านปฏิทินได้
- พนักงานสร้างแผนงานได้ และแก้ไขแผนงานที่ตนเองสร้าง
- Admin แก้ไขและลบแผนงานทุกคนได้
- เฉพาะ Admin จัดการข้อมูลพนักงานและทีมงานผ่านฐานข้อมูลใน Phase 1

## ก่อนใช้งานจริงควรทำเพิ่ม
- เพิ่มการตรวจสอบแผนงานชนกัน (controller และสมาชิกทีม) แบบ transaction ฝั่งฐานข้อมูล
- เพิ่มหน้าเปลี่ยนรหัสผ่านและขั้นตอน reset password
- เพิ่ม audit log แยกต่างหาก (created_by/updated_by มีไว้เป็นข้อมูลเริ่มต้น)
- เพิ่มการแบ่งทีมงานจริงและตัวกรองปฏิทิน
- เพิ่มการทดสอบ RLS ด้วยบัญชี Employee และ Admin
- ตั้งค่า backup และนโยบาย retention ของ Supabase

## หมายเหตุด้านความปลอดภัย
- อย่าเปิดเผย `SUPABASE_SERVICE_ROLE_KEY` ใน browser หรือ repository
- อย่าปิด RLS
- บัญชีพนักงานควรถูกสร้างโดย Admin เท่านั้น
- เปลี่ยนรหัสผ่านชั่วคราวก่อนเริ่มใช้งานจริง
- ควรตรวจสอบนโยบายความปลอดภัยขององค์กรก่อนใช้ข้อมูลแผนงานจริง
