# -*- coding: utf-8 -*-
"""
Bu script, belirtilen bir klasör içindeki ve alt klasörlerindeki tüm PDF, Excel
ve CSV dosyalarını okur. PDF'lerdeki tabloları ve Excel'deki sayfaları CSV
formatına dönüştürür ve tüm sonuçları yeni bir çıktı klasörüne kaydeder.

GEREKSİNİMLER:
Bu script'i çalıştırmadan önce bazı kütüphaneleri yüklemeniz gerekmektedir.
Aşağıdaki komutları terminal veya komut istemcisinde çalıştırarak yükleyebilirsiniz:
pip install pandas tabula-py openpyxl

ÖNEMLİ NOT (JAVA KURULUMU):
'tabula-py' kütüphanesinin PDF dosyalarını okuyabilmesi için bilgisayarınızda
Java'nın kurulu olması gerekmektedir. Eğer Java kurulu değilse, script PDF
dönüştürme adımında hata verecektir.
Java'yı https://www.java.com/tr/download/ adresinden indirip kurabilirsiniz.

KULLANIM:
1. Bu script'i ve "FİYAT LİSTESİ" adlı klasörünüzü aynı dizine koyun.
2. Script'i çalıştırdığınızda, "csv_cikti" adında yeni bir klasör oluşturulacak
   ve tüm dönüştürülmüş dosyalar bu klasörün içine kaydedilecektir.
"""

import os
import pandas as pd
import tabula  # PDF'ten tablo okumak için


def dosyalari_csvye_donustur(kaynak_klasor, cikti_klasor):
    """
    Belirtilen kaynak klasördeki dosyaları işler ve CSV'ye dönüştürür.

    Args:
        kaynak_klasor (str): İşlenecek dosyaların bulunduğu ana klasör.
        cikti_klasor (str): Dönüştürülen CSV dosyalarının kaydedileceği klasör.
    """
    # Çıktı klasörü yoksa oluştur
    if not os.path.exists(cikti_klasor):
        os.makedirs(cikti_klasor)
        print(f"'{cikti_klasor}' adında çıktı klasörü oluşturuldu.")

    print(f"'{kaynak_klasor}' içindeki dosyalar işleniyor...")

    # Kaynak klasördeki tüm dosya ve alt klasörleri gez
    for root, dirs, files in os.walk(kaynak_klasor):
        for dosya_adi in files:
            # Dosyanın tam yolunu al
            dosya_yolu = os.path.join(root, dosya_adi)

            # Dosya adından uzantısız kısmı ve uzantıyı ayır
            dosya_kok, dosya_uzanti = os.path.splitext(dosya_adi)
            dosya_uzanti = dosya_uzanti.lower()

            print(f"\n-> İşleniyor: {dosya_adi}")

            try:
                # 1. PDF Dosyalarını İşleme
                if dosya_uzanti == '.pdf':
                    try:
                        pdf_tablolari = tabula.read_pdf(
                            dosya_yolu,
                            pages='all',
                            multiple_tables=True,
                            stream=True,
                            pandas_options={'header': None}
                        )

                        if not pdf_tablolari:
                            print(f"  -> UYARI: '{dosya_adi}' içinde okunabilir tablo bulunamadı.")
                            continue

                        for i, tablo_df in enumerate(pdf_tablolari):
                            if not tablo_df.empty:
                                cikti_dosya_adi = f"{dosya_kok}_tablo_{i + 1}.csv"
                                cikti_yolu = os.path.join(cikti_klasor, cikti_dosya_adi)
                                tablo_df.to_csv(cikti_yolu, index=False, header=False, encoding='utf-8-sig')
                                print(f"  -> '{cikti_dosya_adi}' olarak kaydedildi.")

                    except Exception as e:
                        print(f"  -> HATA: '{dosya_adi}' PDF dosyası işlenirken hata oluştu: {e}")

                # 2. Excel Dosyalarını İşleme (.xlsx, .xls)
                elif dosya_uzanti in ['.xlsx', '.xls']:
                    try:
                        # Excel dosyasındaki tüm sayfaları bir sözlük olarak oku
                        tum_sayfalar = pd.read_excel(dosya_yolu, sheet_name=None)

                        if not tum_sayfalar:
                            print(f"  -> UYARI: '{dosya_adi}' içinde okunacak sayfa bulunamadı.")
                            continue

                        # Her bir sayfayı ayrı bir CSV dosyası olarak kaydet
                        for sayfa_adi, sayfa_df in tum_sayfalar.items():
                            if not sayfa_df.empty:
                                # Çıktı dosya adını Excel adı ve sayfa adıyla birleştirerek oluştur
                                cikti_dosya_adi = f"{dosya_kok}_{sayfa_adi}.csv"
                                cikti_yolu = os.path.join(cikti_klasor, cikti_dosya_adi)

                                sayfa_df.to_csv(cikti_yolu, index=False, encoding='utf-8-sig')
                                print(f"  -> '{sayfa_adi}' sayfası '{cikti_dosya_adi}' olarak kaydedildi.")

                    except Exception as e:
                        print(f"  -> HATA: '{dosya_adi}' Excel dosyası işlenirken hata oluştu: {e}")

                # 3. CSV Dosyalarını İşleme (Yeniden Formatlama ve Kopyalama)
                elif dosya_uzanti == '.csv':
                    try:
                        df = pd.read_csv(dosya_yolu, low_memory=False)
                        cikti_yolu = os.path.join(cikti_klasor, dosya_adi)
                        df.to_csv(cikti_yolu, index=False, encoding='utf-8-sig')
                        print(f"  -> '{dosya_adi}' CSV olarak yeniden formatlanıp kopyalandı.")

                    except Exception as e:
                        print(f"  -> HATA: '{dosya_adi}' CSV dosyası okunurken hata oluştu: {e}")

                # 4. Diğer dosya türlerini atla
                else:
                    print(f"  -> Atlanıyor: Desteklenmeyen dosya türü '{dosya_uzanti}'.")

            except Exception as genel_hata:
                print(f"  -> GENEL HATA: '{dosya_adi}' işlenemedi: {genel_hata}")

    print("\n--- Tüm işlemler başarıyla tamamlandı! ---")


if __name__ == '__main__':
    KAYNAK_KLASOR = "FİYAT LİSTESİ"
    CIKTI_KLASOR = "csv_cikti"

    if os.path.exists(KAYNAK_KLASOR):
        dosyalari_csvye_donustur(KAYNAK_KLASOR, CIKTI_KLASOR)
    else:
        print(f"HATA: '{KAYNAK_KLASOR}' adında bir klasör bulunamadı.")
        print(
            "Lütfen dosyalarınızın bulunduğu klasörün adının doğru olduğundan ve script ile aynı dizinde olduğundan emin olun.")

