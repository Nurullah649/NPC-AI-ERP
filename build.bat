@echo OFF
echo.
echo ==========================================================
echo           NPC-AI ERP UYGULAMASI DERLEME SCRIPT'I
echo ==========================================================
echo.

REM Adım 1: Next.js (Arayüz) projesini derle
echo [1/5] Next.js arayuz projesi derleniyor (npm run build)...
cd medical-chemical-sales
call npm run build
IF %ERRORLEVEL% NEQ 0 (
echo HATA: Next.js derlemesi basarisiz oldu.
goto :error
)
cd ..
echo Arayuz derlemesi basariyla tamamlandi.
echo.

REM Adım 2: PyInstaller ile Python arka plan servisini EXE yap
echo [2/5] Python arka plan servisi EXE'ye donusturuluyor (PyInstaller)...
pyinstaller --onefile --noconsole --name desktop_app --add-data ".env;." desktop_app_electron.py
IF %ERRORLEVEL% NEQ 0 (
echo HATA: PyInstaller paketlemesi basarisiz oldu.
goto :error
)
echo Python EXE dosyasi basariyla olusturuldu.
echo.

REM Adım 3: Oluşturulan EXE'yi bin klasörüne taşı
echo [3/5] Olusturulan EXE dosyasi 'bin' klasorune tasiniyor...
IF NOT EXIST "bin" (
mkdir bin
echo 'bin' klasoru olusturuldu.
)
move /Y "dist\desktop_app.exe" "bin\desktop_app.exe"
IF %ERRORLEVEL% NEQ 0 (
echo HATA: EXE dosyasi tasinamadi.
goto :error
)
echo EXE dosyasi basariyla tasindi.
echo.

REM Adım 4: Electron Builder ile kurulum dosyasını oluştur
echo [4/5] Kurulum dosyasi (setup.exe) olusturuluyor (npm run dist)...
call npm run dist
IF %ERRORLEVEL% NEQ 0 (
echo HATA: Kurulum dosyasi olusturulamadi.
goto :error
)
echo Kurulum dosyasi basariyla olusturuldu.
echo.

REM Adım 5: Temizlik
echo [5/5] Gecici derleme dosyalari temizleniyor...
rmdir /S /Q "build"
del "*.spec"
echo Temizlik tamamlandi.
echo.

echo ==========================================================
echo TUM ISLEMLER BASARIYLA TAMAMLANDI!
echo Kurulum dosyaniz 'dist' klasoru altinda olusturuldu.
echo ==========================================================
echo.
goto :end

:error
echo.
echo !!!!!!! BIR HATA OLUSTU. LUTFEN YUKARIDAKI MESAJLARI KONTROL EDIN. !!!!!!!
echo.

:end
pause