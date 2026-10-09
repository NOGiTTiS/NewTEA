import { auth } from '../lib/auth'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://tea_user:tea_password@localhost:5432/tunorth-tea_db?sslmode=disable'
})

async function seedAdmin() {
  console.log('🚀 เริ่มต้นกระบวนการ Seed บัญชีผู้ดูแลระบบ (Admin Users)...')

  try {
    // 1. ตรวจสอบหรือสร้างบัญชี admin@tn.ac.th
    const adminEmail = 'admin@tn.ac.th'
    const adminPassword = 'Admin@2026'
    const adminName = 'ผู้ดูแลระบบ NewTEA (Admin)'

    const checkAdmin = await pool.query(
      'SELECT id, email, role FROM "user" WHERE email = $1',
      [adminEmail]
    )

    if (checkAdmin.rows.length === 0) {
      console.log(`⏳ กำลังสร้างบัญชี ${adminEmail} ผ่าน Better Auth...`)
      await auth.api.signUpEmail({
        body: {
          name: adminName,
          email: adminEmail,
          password: adminPassword
        }
      })
      console.log(`✅ สร้างบัญชี ${adminEmail} สำเร็จ`)
    } else {
      console.log(`ℹ️ พบบัญชี ${adminEmail} ในระบบแล้ว`)
    }

    // อัปเดตสิทธิ์ admin@tn.ac.th ให้เป็น ADMIN
    await pool.query('UPDATE "user" SET role = $1 WHERE email = $2', [
      'ADMIN',
      adminEmail
    ])
    console.log(`🛡️ กำหนดสิทธิ์ ADMIN ให้กับ ${adminEmail} เรียบร้อยแล้ว`)

    // 2. อัปเดตสิทธิ์ sittigon.b@tn.ac.th ให้เป็น ADMIN หากมีบัญชีในระบบ
    const teacherEmail = 'sittigon.b@tn.ac.th'
    const checkTeacher = await pool.query(
      'SELECT id, email, role FROM "user" WHERE email = $1',
      [teacherEmail]
    )

    if (checkTeacher.rows.length > 0) {
      await pool.query('UPDATE "user" SET role = $1 WHERE email = $2', [
        'ADMIN',
        teacherEmail
      ])
      console.log(`🛡️ กำหนดสิทธิ์ ADMIN ให้กับ ${teacherEmail} เรียบร้อยแล้ว`)
    }

    // 3. แสดงรายการผู้ดูแลระบบทั้งหมดในฐานข้อมูล
    console.log('\n📋 รายชื่อผู้ดูแลระบบ (ADMIN) ทั้งหมดในระบบปัจจุบัน:')
    const allAdmins = await pool.query(
      'SELECT id, email, name, role FROM "user" WHERE role = $1 ORDER BY name',
      ['ADMIN']
    )
    console.table(allAdmins.rows)

    console.log('\n✨ ข้อมูลสำหรับการเข้าสู่ระบบ:')
    console.log('----------------------------------------------------')
    console.log(`• อีเมล (Email):     ${adminEmail}`)
    console.log(`• รหัสผ่าน (Password): ${adminPassword}`)
    console.log('• URL เข้าสู่ระบบ:    http://localhost:3000/login')
    console.log('----------------------------------------------------')
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการ Seed บัญชีผู้ดูแลระบบ:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seedAdmin().catch(console.error)
