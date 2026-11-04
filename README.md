PassItU (PassIt University Sharing)

PassItU เป็นแอปพลิเคชันแบ่งปันและแลกเปลี่ยนของมือสองสำหรับนักศึกษาในมหาวิทยาลัย พัฒนาด้วย React Native และ Expo ช่วยให้การส่งต่อสิ่งของทำได้ง่าย ปลอดภัย พร้อมระบบสะสมแต้มและแลกของรางวัลเพื่อส่งเสริมสังคมแห่งการแบ่งปัน

---

## Features

- Authentication & Security: ระบบลงทะเบียน เข้าสู่ระบบ รีเซ็ตรหัสผ่าน และยืนยันตัวตนผ่าน Firebase
- Item Management: โพสต์เพิ่มรายการของที่ต้องการส่งต่อหรือแลกเปลี่ยน อัปโหลดรูปภาพ และจัดการรายการของตนเอง
- Location & Map Integration: ปักหมุดพิกัดสถานที่นัดรับ-ส่งของผ่านแผนที่
- In-App Messaging & Chat: ระบบแชตพูดคุยเพื่อนัดหมายการรับของระหว่างผู้ส่งและผู้รับ
- QR Code Exchange: ยืนยันการส่งมอบและรับของผ่านการสแกน QR Code เพื่อความถูกต้องปลอดภัย
- Points & Rewards System: ระบบสะสมแต้มจากการแบ่งปัน ตรวจสอบประวัติการใช้แต้ม และแลกของรางวัล
- Notifications: ระบบแจ้งเตือนสถานะดีล การแชต และกิจกรรมต่างๆ พร้อมเสียงแจ้งเตือน

---

## Tech Stack

- Framework: React Native + Expo (SDK 54)
- Language: JavaScript (React 19)
- Backend & Database: Firebase (Auth, Firestore, Storage)
- Navigation: React Navigation v7 (Stack Navigation)
- UI & Components: React Native Safe Area Context, React Native SVG, Expo Vector Icons
- Maps & Location: react-native-maps, expo-location, geolib
- Scanner & Media: expo-camera, react-native-qrcode-svg, expo-image-picker
- Audio & Notifications: expo-av, expo-notifications

---

## Getting Started

### Prerequisites
- Node.js (เวอร์ชัน 18 ขึ้นไป)
- Expo Go App บนมือถือ (iOS หรือ Android) หรือ Emulator / Simulator

### Installation

1. Clone Repository
   ```bash
   git clone [https://github.com/Warachayaa/passit-university-sharing.git](https://github.com/Warachayaa/passit-university-sharing.git)
   cd passit-university-sharing
