# 🛡️ Firebase Security Setup & Key Rotation Guide - IzerWorks TaskPanel

Dokumen ini memuat panduan lengkap penanganan insiden _exposed secret_ (kunci API Firebase bocor), langkah rotasi kunci API di Google Cloud Console, pembatasan HTTP referrer, konfigurasi environment variables Vite, serta Firestore Security Rules.

---

## 1. Langkah Cepat: Rotasi & Revokasi API Key

Kunci API Firebase lama (`AIzaSyCPWG...`) yang sempat tertera di `index.html` harus segera diganti dan dihapus. Kunci publik Firebase pada aplikasi web klien aman selama dikonfigurasi dengan **HTTP Referrer Restrictions** dan **Firestore Security Rules**.

### Langkah A: Buat API Key Baru di Google Cloud Console

1. Buka [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials).
2. Pastikan proyek yang aktif adalah **`task-izerworks`**.
3. Klik tombol **`+ CREATE CREDENTIALS`** di bagian atas, lalu pilih **`API key`**.
4. Salin string API Key baru yang terbentuk.

### Langkah B: Batasi API Key (Restrictions Hardening)

1. Pada daftar API Keys, klik tombol edit (ikon pensil) pada API Key baru yang baru saja dibuat.
2. Beri nama yang jelas, misalnya: `TaskPanel Web Client Key (Restricted)`.
3. Di bagian **Set application restrictions**:
   - Pilih **Websites** (HTTP referrers).
   - Tambahkan URL origin yang diizinkan:
     - `http://localhost:*/*` (untuk development lokal)
     - `http://127.0.0.1:*/*` (untuk development lokal)
     - `https://task.izerworks.my.id/*` (domain kustom produksi)
     - `https://*.vercel.app/*` (jika menggunakan Vercel)
     - `https://task-izerworks.firebaseapp.com/*`
     - `https://task-izerworks.web.app/*`
4. Di bagian **API restrictions**:
   - Pilih **Restrict key**.
   - Centang hanya API yang dibutuhkan:
     - **Identity Toolkit API** (Firebase Authentication)
     - **Cloud Firestore API**
     - **Token Service API**
5. Klik **Save**.

### Langkah C: Pasang Kunci Baru di Proyek Lokal

1. Buka file `.env.local` di folder proyek lokal Anda (file ini sudah diabaikan oleh `.gitignore`).
2. Masukkan API Key baru ke variabel `VITE_FIREBASE_API_KEY`:
   ```env
   VITE_FIREBASE_API_KEY=API_KEY_BARU_DARI_GOOGLE_CLOUD
   VITE_FIREBASE_AUTH_DOMAIN=task-izerworks.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=task-izerworks
   VITE_FIREBASE_STORAGE_BUCKET=task-izerworks.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=93397951426
   VITE_FIREBASE_APP_ID=1:93397951426:web:5a1a83fbc079234b612c5b
   VITE_FIREBASE_MEASUREMENT_ID=G-NGD8EEYK1C
   ```

### Langkah D: Revoke (Hapus) API Key Lama

1. Kembali ke [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials).
2. Temukan kunci API lama yang terdeteksi bocor (`AIzaSyCPWG39zMRRdnEETqkxbEnIpJlev244tnI`).
3. Klik ikon tempat sampah (**Delete**) untuk mencabut/menghapus kunci tersebut secara permanen.

---

## 2. Firestore Security Rules

Pastikan database Cloud Firestore Anda hanya mengizinkan pengguna mengakses data milik akun mereka sendiri (`request.auth.uid == userId`).

Buka [Firebase Console - Firestore Rules](https://console.firebase.google.com/project/task-izerworks/firestore/rules) dan pasang aturan berikut:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Koleksi tasks: Hanya pengguna pemilik data yang dapat membaca & memodifikasi
    match /tasks/{taskId} {
      allow read, delete: if request.auth != null && request.auth.uid == resource.data.userId;
      allow update: if request.auth != null && request.auth.uid == resource.data.userId && request.resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }

    // Blokir akses ke koleksi dokumen lain secara default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 3. Menangani GitHub Push Protection / Secret Scanning Block

Jika GitHub memblokir `git push` karena mendeteksi secret di commit lama dalam riwayat Git:

### Opsi 1: Bypass Push Protection (Jika Kunci Lama Sudah Dihapus/Direvoke)

1. Saat push ditolak oleh GitHub, pesan terminal menyertakan tautan unblock khusus, misalnya:
   `https://github.com/Izerrr/Univesal-Taskpanel/security/secret-scanning/unblock-secret/...`
2. Buka link tersebut di browser.
3. Pilih alasan: _"The secret is revoked"_ atau _"Used in tests"_, lalu konfirmasi.
4. Lakukan `git push` kembali.

### Opsi 2: Membersihkan Git History (Opsional)

Jika Anda ingin menghapus commit berisiko dari seluruh histori commit git:

```bash
# Menggunakan git filter-repo (rekomendasi resmi Git/GitHub)
pip install git-filter-repo
git filter-repo --replace-text <(echo "AIzaSyCPWG39zMRRdnEETqkxbEnIpJlev244tnI==>ROTATED_KEY_REMOVED")
git push origin --force --all
```

---

## 4. Cara Menjalankan Proyek (Vite Development)

1. Jalankan development server secara lokal:
   ```bash
   npm run dev
   ```
2. Aplikasi akan aktif di `http://localhost:5173`.
3. Untuk membuat build rilis produksi:
   ```bash
   npm run build
   ```
   Hasil build siap deploy akan berada di folder `dist/`.

---

## 5. Konfigurasi Deployment GitHub Pages (Otomatis via GitHub Actions)

File workflow automasi sudah tersedia di `.github/workflows/deploy.yml`. Agar website otomatis di-build dan di-deploy saat `git push`, lakukan langkah berikut:

### Langkah 1: Masukkan Secrets di GitHub

1. Buka repositori Anda di GitHub.
2. Masuk ke **Settings** > **Secrets and variables** > **Actions**.
3. Klik tombol hijau **New repository secret**, lalu tambahkan variabel berikut satu per satu:
   - `VITE_FIREBASE_API_KEY`: _(API key baru hasil rotasi)_
   - `VITE_FIREBASE_AUTH_DOMAIN`: `task-izerworks.firebaseapp.com`
   - `VITE_FIREBASE_PROJECT_ID`: `task-izerworks`
   - `VITE_FIREBASE_STORAGE_BUCKET`: `task-izerworks.firebasestorage.app`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`: `93397951426`
   - `VITE_FIREBASE_APP_ID`: `1:93397951426:web:5a1a83fbc079234b612c5b`
   - `VITE_FIREBASE_MEASUREMENT_ID`: `G-NGD8EEYK1C`

### Langkah 2: Aktifkan Source GitHub Actions di GitHub Pages

1. Masih di tab **Settings** repositori Anda, pilih menu **Pages** di sidebar kiri.
2. Di bagian **Build and deployment** > **Source**, ubah opsi dari _"Deploy from a branch"_ menjadi **GitHub Actions**.
3. Lakukan `git add .`, `git commit`, dan `git push origin main`.
4. Buka tab **Actions** di GitHub untuk melihat proses build & deploy berjalan otomatis ke domain Anda (`task.izerworks.my.id`).
