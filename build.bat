@echo OFF
echo.
echo ==========================================================
echo           NPC-AI ERP UYGULAMASI DERLEME SCRIPT'I
echo ==========================================================
echo.

REM Adım 1: Next.js (Arayüz) projesini derle
echo [1/6] Next.js arayuz projesi derleniyor (npm run build)...
cd medical-chemical-sales
call npm run build
IF %ERRORLEVEL% NEQ 0 (
    echo HATA: Next.js derlemesi basarisiz oldu.
    goto :error
)
cd ..
echo Arayuz derlemesi basariyla tamamlandi.
echo.

REM Adım 2: Python bagimlilik/syntax/import kontrolu
IF "%CONDA_ENV_NAME%"=="" set "CONDA_ENV_NAME=npcai"
echo [2/6] Python ortami hazirlaniyor ve kontrol ediliyor (conda: %CONDA_ENV_NAME%)...
where conda >NUL 2>NUL
IF %ERRORLEVEL% NEQ 0 (
    echo HATA: conda PATH uzerinde bulunamadi. Anaconda Prompt veya Miniconda Prompt ile calistirin.
    goto :error
)
call conda run -n "%CONDA_ENV_NAME%" python -m pip install --disable-pip-version-check -r python_backend\build-requirements.txt
IF %ERRORLEVEL% NEQ 0 (
    echo HATA: Python bagimlilik kurulumu basarisiz oldu.
    goto :error
)
call conda run -n "%CONDA_ENV_NAME%" python -B python_backend\check_runtime_imports.py
IF %ERRORLEVEL% NEQ 0 (
    echo HATA: Python syntax/import kontrolu basarisiz oldu.
    goto :error
)
echo Python ortami ve import kontrolleri basariyla tamamlandi.
echo.

REM Adım 3: PyInstaller ile Python arka plan servisini EXE yap
echo [3/6] Python arka plan servisi EXE'ye donusturuluyor (PyInstaller)...
REM Playwright runtime dosyalari + Obscura binary pakete dahil edilir.
set "OBSCURA_BIN_ARG="
IF EXIST "obscura.exe" (
    set "OBSCURA_BIN_ARG=--add-binary obscura.exe;."
) ELSE IF EXIST "obscura" (
    set "OBSCURA_BIN_ARG=--add-binary obscura;."
)
call conda run -n "%CONDA_ENV_NAME%" python -m PyInstaller --onefile --noconsole --name desktop_app --add-data ".env;." --collect-all playwright --collect-submodules playwright %OBSCURA_BIN_ARG% python_backend/main.py
IF %ERRORLEVEL% NEQ 0 (
    echo HATA: PyInstaller paketlemesi basarisiz oldu.
    goto :error
)
echo Python EXE dosyasi basariyla olusturuldu.
echo.

REM Adım 4: Oluşturulan EXE'yi bin klasörüne taşı
echo [4/6] Olusturulan EXE dosyasi 'bin' klasorune tasiniyor...
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

REM Adım 5: Electron Builder ile kurulum dosyasını oluştur
echo [5/6] Kurulum dosyasi (setup.exe) olusturuluyor (npm run dist)...
call npm run dist
IF %ERRORLEVEL% NEQ 0 (
    echo HATA: Kurulum dosyasi olusturulamadi.
    goto :error
)
echo Kurulum dosyasi basariyla olusturuldu.
echo.

REM Adım 6: Temizlik
echo [6/6] Gecici derleme dosyalari temizleniyor...
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
