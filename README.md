# Buddy Draw - LINE MINI App Starter (Next.js + @line/liff)

โปรเจกต์เริ่มต้นสำหรับแอปจับฉลากของขวัญบัดดี้ (Secret Santa) บน LINE MINI App

## 1. การตั้งค่า Environment Variables
คัดลอกไฟล์ `.env.example` เป็น `.env.local` แล้วกรอกค่าจาก LINE Developers Console:
- `NEXT_PUBLIC_LIFF_ID`: ดูได้จากแท็บ **Web app settings** (ใช้ของช่อง **Developing** ระหว่างพัฒนา)
- `LINE_CHANNEL_ID`: ดูได้จากแท็บ **Basic settings** (ใช้ **Channel ID** ของช่อง **Developing** เพื่อให้ API `oauth2/v2.1/verify` ตรวจสอบ ID Token ได้ตรงกัน)

## 2. ติดตั้งและรันบนเครื่อง
```bash
npm install
npm run dev
```

## 3. ทดสอบเปิดใน LINE บนมือถือ (ด้วย Cloudflare Tunnel)
```bash
npx cloudflared tunnel --url http://localhost:3000
```
นำ URL `https://...trycloudflare.com` ที่ได้ไปใส่ใน **Endpoint URL** ของช่อง **Developing** บน LINE Developers Console แล้วส่ง **LIFF URL** เข้าแชท LINE เพื่อกดทดสอบได้เลย
