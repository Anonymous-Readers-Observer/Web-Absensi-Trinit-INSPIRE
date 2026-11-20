import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'absensi-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-yang-cukup-panjang-untuk-pengujian-1234567890';
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'Admin#12345';
process.env.ADMIN_NAME = 'Admin Uji';
process.env.SEED_DEMO = 'false';
process.env.SHOW_DEMO_ACCOUNTS = 'false';
process.env.STAFF_CODE = 'KODE-UJI-2026';

const { createApp } = await import('../src/app.js');
const { default: db } = await import('../src/db.js');

const app = await createApp();
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

async function request(method, pathname, { body, cookie = '' } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const setCookies = response.headers.getSetCookie?.() || [];
  const setCookie = setCookies[0] || null;
  const newCookie = setCookie ? setCookie.split(';')[0] : null;
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data, newCookie, headers: response.headers, text };
}

function cookieOf(result) {
  return result.newCookie || '';
}

function addDays(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

test('alur API absensi digital', async (t) => {
  let schoolDate = '';
  let adminCookie = '';
  let studentCookie = '';
  let parentCookie = '';
  let teacherCookie = '';
  let waliCookie = '';
  let studentId = 0;

  await t.test('health dan data sekolah publik tersedia', async () => {
    const health = await request('GET', '/healthz');
    assert.equal(health.status, 200);
    assert.equal(health.data.ok, true);

    const school = await request('GET', '/api/public/school');
    assert.equal(school.status, 200);
    assert.ok(school.data.school.name);
    assert.equal(school.data.stats.students, 0);
    schoolDate = school.data.server.date;
  });

  await t.test('admin dapat masuk', async () => {
    const login = await request('POST', '/api/auth/login', {
      body: { email: 'admin@test.local', password: 'Admin#12345' }
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.user.role, 'admin');
    adminCookie = cookieOf(login);
    assert.ok(adminCookie);

    const me = await request('GET', '/api/auth/me', { cookie: adminCookie });
    assert.equal(me.status, 200);
    assert.equal(me.data.user.email, 'admin@test.local');
  });

  await t.test('siswa dapat mendaftar dan email ganda ditolak', async () => {
    const register = await request('POST', '/api/auth/register', {
      body: {
        name: 'Siswa Uji',
        email: 'siswa.uji@test.local',
        password: 'Siswa#12345',
        role: 'siswa',
        nis: '99901',
        kelas: 'XII-4'
      }
    });
    assert.equal(register.status, 201);
    assert.equal(register.data.user.role, 'siswa');
    studentId = register.data.user.id;
    studentCookie = cookieOf(register);
    assert.ok(studentCookie);

    const duplicate = await request('POST', '/api/auth/register', {
      body: {
        name: 'Siswa Lain',
        email: 'siswa.uji@test.local',
        password: 'Siswa#12345',
        role: 'siswa',
        nis: '99902',
        kelas: 'XII-4'
      }
    });
    assert.equal(duplicate.status, 409);
  });

  await t.test('password salah ditolak', async () => {
    const login = await request('POST', '/api/auth/login', {
      body: { email: 'siswa.uji@test.local', password: 'salah-password' }
    });
    assert.equal(login.status, 401);
  });

  await t.test('orang tua wajib memakai NIS anak yang valid', async () => {
    const wrong = await request('POST', '/api/auth/register', {
      body: {
        name: 'Orang Tua Uji',
        email: 'ortu.uji@test.local',
        password: 'Ortu#12345',
        role: 'ortu',
        childNis: '00000'
      }
    });
    assert.equal(wrong.status, 409);

    const register = await request('POST', '/api/auth/register', {
      body: {
        name: 'Orang Tua Uji',
        email: 'ortu.uji@test.local',
        password: 'Ortu#12345',
        role: 'ortu',
        childNis: '99901'
      }
    });
    assert.equal(register.status, 201);
    assert.equal(register.data.user.child.nis, '99901');
    parentCookie = cookieOf(register);
  });

  await t.test('kode staf diverifikasi', async () => {
    const wrong = await request('POST', '/api/auth/register', {
      body: {
        name: 'Guru Uji',
        email: 'guru.uji@test.local',
        password: 'Staf#12345',
        role: 'guru',
        staffCode: 'KODE-SALAH'
      }
    });
    assert.equal(wrong.status, 403);

    const register = await request('POST', '/api/auth/register', {
      body: {
        name: 'Guru Uji',
        email: 'guru.uji@test.local',
        password: 'Staf#12345',
        role: 'guru',
        staffCode: 'KODE-UJI-2026'
      }
    });
    assert.equal(register.status, 201);
    teacherCookie = cookieOf(register);

    const wali = await request('POST', '/api/auth/register', {
      body: {
        name: 'Wali Uji',
        email: 'wali.uji@test.local',
        password: 'Staf#12345',
        role: 'wali',
        kelas: 'XII-4',
        staffCode: 'KODE-UJI-2026'
      }
    });
    assert.equal(wali.status, 201);
    waliCookie = cookieOf(wali);
  });

  await t.test('admin dapat mengatur lokasi sekolah', async () => {
    const update = await request('PUT', '/api/admin/settings', {
      cookie: adminCookie,
      body: {
        schoolName: 'SMA Trinitas Bandung',
        address: 'Jl. Kebon Jati, Bandung',
        latitude: -6.9171146,
        longitude: 107.5916152,
        radiusM: 150,
        startTime: '07:15',
        maxAccuracyM: 200
      }
    });
    assert.equal(update.status, 200);
    assert.equal(update.data.settings.radiusM, 150);
    assert.equal(update.data.settings.latitude, -6.9171146);
  });

  await t.test('GPS di luar radius ditolak, di dalam radius diterima sekali', async () => {
    const far = await request('POST', '/api/attendance/checkin', {
      cookie: studentCookie,
      body: { lat: -6.95, lng: 107.65, accuracy: 10 }
    });
    assert.equal(far.status, 403);
    assert.ok(far.data.details.distance > 150);

    const near = await request('POST', '/api/attendance/checkin', {
      cookie: studentCookie,
      body: { lat: -6.9172, lng: 107.5917, accuracy: 12 }
    });
    assert.equal(near.status, 201);
    assert.ok(['hadir', 'terlambat'].includes(near.data.status));
    assert.ok(near.data.distance < 150);

    const again = await request('POST', '/api/attendance/checkin', {
      cookie: studentCookie,
      body: { lat: -6.9172, lng: 107.5917, accuracy: 12 }
    });
    assert.equal(again.status, 409);
    assert.ok(again.data.details.attendance);
  });

  await t.test('papan publik hanya memuat data yang aman', async () => {
    const board = await request('GET', '/api/public/board');
    assert.equal(board.status, 200);
    assert.equal(board.data.rows.length, 1);
    assert.equal(board.data.rows[0].name, 'Siswa Uji');
    assert.equal(board.data.rows[0].nis, undefined);
    assert.equal(board.data.rows[0].lat, undefined);
    assert.equal(board.data.rows[0].distance, undefined);
    assert.ok(board.data.summary.recorded >= 1);
  });

  await t.test('orang tua melihat riwayat dan notifikasi anak', async () => {
    const child = await request('GET', '/api/attendance/child', { cookie: parentCookie });
    assert.equal(child.status, 200);
    assert.equal(child.data.child.nis, '99901');
    assert.ok(child.data.rows.length >= 1);

    const notifications = await request('GET', '/api/notifications', { cookie: parentCookie });
    assert.equal(notifications.status, 200);
    assert.ok(notifications.data.unread >= 1);
    assert.ok(notifications.data.rows[0].body.includes('Siswa Uji'));
  });

  await t.test('siswa tidak boleh mengakses rekap staf', async () => {
    const recap = await request('GET', '/api/attendance/recap', { cookie: studentCookie });
    assert.equal(recap.status, 403);
  });

  await t.test('guru dan wali dapat melihat rekap sesuai kelas', async () => {
    const recap = await request('GET', '/api/attendance/recap', { cookie: teacherCookie });
    assert.equal(recap.status, 200);
    assert.equal(recap.data.rows.length, 1);
    assert.equal(recap.data.rows[0].nis, '99901');

    const wali = await request('GET', '/api/attendance/recap?kelas=X-1', { cookie: waliCookie });
    assert.equal(wali.status, 403);

    const waliOwn = await request('GET', '/api/attendance/recap?kelas=XII-4', { cookie: waliCookie });
    assert.equal(waliOwn.status, 200);
    assert.equal(waliOwn.data.kelas, 'XII-4');
  });

  await t.test('staf dapat menandai izin/sakit/alpa secara manual', async () => {
    const date = addDays(schoolDate, -1);
    const mark = await request('POST', '/api/attendance/mark', {
      cookie: teacherCookie,
      body: { userId: studentId, date, status: 'izin', note: 'Keperluan keluarga' }
    });
    assert.equal(mark.status, 201);
    assert.equal(mark.data.attendance.status, 'izin');

    const recap = await request('GET', `/api/attendance/recap?date=${date}`, { cookie: teacherCookie });
    assert.equal(recap.status, 200);
    assert.equal(recap.data.rows[0].status, 'izin');
  });

  await t.test('rentang dan pembinaan mengembalikan data', async () => {
    const range = await request('GET', `/api/attendance/range?from=${addDays(schoolDate, -20)}&to=${schoolDate}`, { cookie: teacherCookie });
    assert.equal(range.status, 200);

    const pembinaan = await request('GET', '/api/attendance/pembinaan', { cookie: teacherCookie });
    assert.equal(pembinaan.status, 200);
    assert.ok(Array.isArray(pembinaan.data.rows));
  });

  await t.test('ekspor CSV tersedia untuk staf', async () => {
    const response = await fetch(`${base}/api/attendance/export.csv`, {
      headers: { Cookie: teacherCookie }
    });
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.ok(text.includes('Tanggal'));
    assert.ok(text.includes('Siswa Uji'));
    assert.ok(text.includes('99901'));
  });

  await t.test('admin dapat mengelola pengguna, impor, dan backup', async () => {
    const list = await request('GET', '/api/admin/users?role=siswa', { cookie: adminCookie });
    assert.equal(list.status, 200);
    assert.equal(list.data.total, 1);

    const create = await request('POST', '/api/admin/users', {
      cookie: adminCookie,
      body: {
        name: 'Siswa Impor Manual',
        email: 'manual@test.local',
        password: 'Siswa#12345',
        role: 'siswa',
        nis: '99902',
        kelas: 'X-1'
      }
    });
    assert.equal(create.status, 201);
    const newId = create.data.user.id;

    const update = await request('PATCH', `/api/admin/users/${newId}`, {
      cookie: adminCookie,
      body: { kelas: 'X-2', phone: '0812-3456-7890' }
    });
    assert.equal(update.status, 200);
    assert.equal(update.data.user.kelas, 'X-2');

    const reset = await request('POST', `/api/admin/users/${newId}/reset-password`, {
      cookie: adminCookie,
      body: { newPassword: 'Baru#12345' }
    });
    assert.equal(reset.status, 200);

    const login = await request('POST', '/api/auth/login', {
      body: { email: 'manual@test.local', password: 'Baru#12345' }
    });
    assert.equal(login.status, 200);

    const imported = await request('POST', '/api/admin/users/import', {
      cookie: adminCookie,
      body: {
        rows: [
          { name: 'Impor Satu', email: 'impor1@test.local', nis: '99903', kelas: 'X-1' },
          { name: 'Impor Dua', email: 'impor2@test.local', nis: '99904', kelas: 'X-1' },
          { name: 'Tanpa NIS', email: 'impor3@test.local', kelas: 'X-1' }
        ]
      }
    });
    assert.equal(imported.status, 201);
    assert.equal(imported.data.createdCount, 2);
    assert.equal(imported.data.errorCount, 1);
    assert.ok(imported.data.created[0].password);

    const backup = await fetch(`${base}/api/admin/backup`, { headers: { Cookie: adminCookie } });
    assert.equal(backup.status, 200);
    assert.ok((await backup.arrayBuffer()).byteLength > 1000);

    const overview = await request('GET', '/api/reports/overview', { cookie: adminCookie });
    assert.equal(overview.status, 200);
    assert.ok(overview.data.trend.length > 0);
    assert.ok(overview.data.counts.siswa >= 4);
  });

  await t.test('logout menghapus sesi', async () => {
    const logout = await request('POST', '/api/auth/logout', { cookie: adminCookie });
    assert.equal(logout.status, 200);
    assert.ok(logout.newCookie?.includes('trinitas_session='));

    const me = await request('GET', '/api/auth/me', { cookie: '' });
    assert.equal(me.status, 401);
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  try {
    db.close();
  } catch {
    // abaikan
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
