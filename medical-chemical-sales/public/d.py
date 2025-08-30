import re
import json

# NOT: Bu betiği çalıştırmadan önce, animasyonlu SVG verilerinizi içeren
# 'svg.txt' dosyasının ve güncellenecek 'SplashScreen.jsx' dosyasının
# bu betikle aynı klasörde olduğundan emin olun.

# --- Dosya Yolları ---
# SVG verilerini içeren dosyanın adı.
# Bu dosyayı, SVG kodunuzu kopyalayıp yapıştırarak oluşturmalısınız.
svg_file_path = 'svg.txt'
# Güncellenecek olan React bileşen dosyasının adı.
jsx_file_path = 'SplashScreen.jsx'

print(f"'{svg_file_path}' dosyasından veriler okunuyor...")
print(f"'{jsx_file_path}' dosyası güncellenecek...")

try:
    # 1. SVG dosyasının tüm içeriğini oku
    with open(svg_file_path, 'r', encoding='utf-8') as f:
        svg_content = f.read()

    # 2. SVG içindeki TÜM <path> etiketlerini, renk (`fill`) ve yol (`d`) bilgileriyle birlikte bul.
    # Bu regex, her bir path etiketi için (renk, yol) şeklinde bir demet (tuple) döndürür.
    # re.DOTALL, . karakterinin yeni satırları da içermesini sağlar, bu da çok satırlı path verileri için önemlidir.
    paths_found = re.findall(r'<path.*?fill="([^"]+)".*?d="([^"]+)".*?/>', svg_content, re.DOTALL)

    if not paths_found:
        print(f"Hata: '{svg_file_path}' içinde uygun formatta <path> etiketi bulunamadı.")
        exit()

    print(f"{len(paths_found)} adet <path> etiketi bulundu ve işleniyor...")

    # 3. Bulunan path verilerini React bileşeninin beklediği veri yapısına dönüştür.
    logo_data = {
        "background": {},
        "elements": []
    }

    # İlk path'i arka plan olarak ata
    background_fill, background_d = paths_found[0]
    logo_data["background"] = {
        "fill": background_fill,
        "d": " ".join(background_d.split())  # Satır sonu ve fazla boşlukları temizle
    }

    # Geri kalan tüm path'leri 'elements' dizisine ekle
    for fill, d in paths_found[1:]:
        logo_data["elements"].append({
            "fill": fill,
            "d": " ".join(d.split())  # Satır sonu ve fazla boşlukları temizle
        })

    # 4. Bu Python dictionary'sini, JSX dosyasına yazılacak bir JavaScript obje string'ine dönüştür.
    # JSON kütüphanesini kullanarak düzgün formatlı bir string oluşturuyoruz.
    # indent=2 ile okunabilirliği artırıyoruz.
    js_object_string = json.dumps(logo_data, indent=2)

    # JSON'un kullandığı çift tırnakları, JavaScript'te daha yaygın olan tek tırnaklara çevirebiliriz (isteğe bağlı).
    # Bu adım, kodun daha temiz görünmesini sağlar.
    js_object_string = js_object_string.replace('"', "'")

    # 5. Mevcut JSX dosyasının içeriğini oku.
    with open(jsx_file_path, 'r', encoding='utf-8') as f:
        jsx_content = f.read()

    # 6. `const LOGO_DATA = { ... };` bloğunun tamamını bul ve yeni oluşturduğumuz string ile değiştir.
    # Bu regex, "const LOGO_DATA" ile başlayıp ilk noktalı virgüle kadar olan her şeyi yakalar.
    updated_jsx_content = re.sub(
        r'const LOGO_DATA\s*=\s*\{.*?\};',
        f'const LOGO_DATA = {js_object_string};',
        jsx_content,
        flags=re.DOTALL
    )

    # 7. Güncellenmiş içeriği tekrar JSX dosyasına yaz.
    with open(jsx_file_path, 'w', encoding='utf-8') as f:
        f.write(updated_jsx_content)

    print(f"\nİşlem tamamlandı! '{jsx_file_path}' dosyası, SVG'nizdeki tüm katmanlarla başarıyla güncellendi.")

except FileNotFoundError as e:
    print(f"Hata: Dosya bulunamadı. Lütfen '{e.filename}' dosyasının doğru klasörde olduğundan emin olun.")
except Exception as e:
    print(f"Beklenmedik bir hata oluştu: {e}")
