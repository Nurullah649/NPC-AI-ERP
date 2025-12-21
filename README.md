<div align="center">
<img src="assets/icon.png" alt="NPC-AI ERP Logo" width="120" style="border-radius: 20%;" />

<h1 align="center">NPC-AI ERP</h1>

<h3 align="center">
Yeni Nesil Akıllı Kurumsal Kaynak Planlama ve 




Tedarik Zinciri Yönetim Sistemi
</h3>

<p align="center">
<b>Sigma, TCI, Netflex</b> entegrasyonları ile güçlendirilmiş, AI tabanlı satın alma ve stok yönetim çözümü.
</p>

<!-- Rozetler -->

<p align="center">
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Backend-Python-3776AB%3Fstyle%3Dfor-the-badge%26logo%3Dpython%26logoColor%3Dwhite" />
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Framework-Electron-47848F%3Fstyle%3Dfor-the-badge%26logo%3Delectron%26logoColor%3Dwhite" />
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Frontend-React-61DAFB%3Fstyle%3Dfor-the-badge%26logo%3Dreact%26logoColor%3Dblack" />
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Database-SQLite-003B57%3Fstyle%3Dfor-the-badge%26logo%3Dsqlite%26logoColor%3Dwhite" />
<img src="https://www.google.com/search?q=https://img.shields.io/badge/License-MIT-green%3Fstyle%3Dfor-the-badge" />
</p>
</div>

🚀 Proje Hakkında

NPC-AI ERP, özellikle medikal, kimya ve laboratuvar sektörleri için tasarlanmış, yapay zeka destekli bir masaüstü ERP (Enterprise Resource Planning) yazılımıdır.

Geleneksel ERP sistemlerinin hantallığını ortadan kaldırarak; ürün arama, stok takibi, teklif oluşturma ve faturalandırma süreçlerini tek bir modern arayüzde birleştirir. Python tabanlı akıllı veri motoru sayesinde, global tedarikçi veritabanlarında (Sigma Aldrich, TCI vb.) saniyeler içinde arama yapar ve en uygun fiyat/stok bilgisini kullanıcının önüne getirir.

Neden NPC-AI ERP?

Akıllı Tedarik: Manuel ürün aramaya son. Tek tıkla 5+ global tedarikçiyi tarayın.

Tam Entegrasyon: Arama sonuçlarını doğrudan stok kartına veya teklife dönüştürün.

Çevrimdışı Çalışma: SQLite altyapısı ile internet kesintilerinde bile verilere erişim.

✨ Temel Özellikler

🔍 AI Destekli Ürün Arama Motoru

Global Tarama: Sigma Aldrich, TCI Chemicals, Netflex ve yerel tedarikçilerde eş zamanlı CAS No / Ürün Adı araması.

Otomatik Veri Çekme: Ürün görselleri, teknik spekler ve fiyat bilgilerini otomatik olarak sisteme kaydeder.

💼 Finans ve Müşteri Yönetimi

Teklif & Fatura: Sürükle-bırak yöntemiyle profesyonel PDF teklifler ve faturalar oluşturun.

CRM Modülü: Müşteri cari hesapları, geçmiş siparişler ve iletişim bilgileri yönetimi.

💻 Modern Masaüstü Deneyimi

Cross-Platform: Electron.js sayesinde Windows, macOS ve Linux üzerinde sorunsuz çalışır.

Otomatik Güncelleme: Yazılım, yeni özellikler geldiğinde kendini otomatik olarak günceller.

Güvenli Lisanslama: Sunucu tabanlı lisans doğrulama sistemi ile yazılım güvenliği.

🛠️ Teknik Mimari

Proje, performans, güvenlik ve geliştirme hızı için Hybrid bir mimari kullanır:

Katman

Teknoloji

Görevi

Core (Backend)

Python / Node.js

Veri kazıma (Scraping), İş mantığı ve API yönetimi.

Application

Electron.js

Masaüstü pencere yönetimi ve işletim sistemi entegrasyonu.

Interface (UI)

React

Hızlı, reaktif ve modern kullanıcı arayüzü.

Database

SQLite

Yerel, hızlı ve güvenilir veri depolama.

Security

License Key

Uzaktan sunucu doğrulamalı lisans ve aktivasyon sistemi.

🚀 Kurulum ve Başlatma

Projeyi yerel ortamınızda geliştirmek veya kaynak koddan derlemek için aşağıdaki adımları izleyin:

Ön Gereksinimler

Node.js (v16+)

Python (v3.8+)

Git

1. Depoyu Klonlayın

git clone [https://github.com/Nurullah649/NPC-AI-ERP.git](https://github.com/Nurullah649/NPC-AI-ERP.git)
cd NPC-AI-ERP


2. Bağımlılıkları Yükleyin (Frontend & Backend)

# Node.js paketleri (Electron ve React için)
npm install

# Python bağımlılıkları (Veri motoru için)
pip install -r requirements.txt


3. Geliştirme Modunda Başlatın

# Hem React sunucusunu hem de Electron penceresini başlatır
npm run dev


4. Uygulamayı Derleyin (Build)

# İşletim sisteminize uygun dağıtılabilir dosya (.exe, .dmg, .AppImage) oluşturur
npm run build


🛣️ Yol Haritası (Roadmap)

[x] Temel ERP Modülleri (Stok, Cari, Fatura)

[x] Python tabanlı Tedarikçi Scraper Motoru

[x] Electron ve React Entegrasyonu

[ ] v1.5: AI destekli fiyat tahminleme modülü

[ ] v2.0: Bulut (Cloud) senkronizasyonu ve Mobil Uygulama

[ ] v2.1: E-Fatura entegrasyonu

🤝 Katkıda Bulunma

Açık kaynak topluluğunun gücüne inanıyoruz! NPC-AI ERP'ye katkıda bulunmak isterseniz:

Bu depoyu Fork'layın.

Yeni bir özellik dalı (branch) oluşturun (git checkout -b feature/HarikaOzellik).

Değişikliklerinizi commit'leyin (git commit -m 'HarikaOzellik eklendi').

Dalınızı push'layın (git push origin feature/HarikaOzellik).

Bir Pull Request oluşturun.

Lütfen büyük değişiklikler yapmadan önce tartışmak için bir "Issue" açınız.

📄 Lisans

Bu proje MIT Lisansı altında lisanslanmıştır.

MIT License

Copyright (c) 2025 Nurullah Kurnaz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


<div align="center">
<p>Geliştirici: <a href="https://github.com/Nurullah649">Nurullah Kurnaz</a></p>
</div>
