import sys
import os
import importlib
import traceback

def check_import(module_name):
    try:
        importlib.import_module(module_name)
        print(f"[OK] Import: {module_name}")
        return True
    except ImportError as e:
        print(f"[FAIL] Import: {module_name} - {e}")
        return False
    except Exception as e:
        print(f"[FAIL] Import: {module_name} - Unexpected error: {e}")
        return False

def check_src_modules():
    print("\n--- Checking Local Modules (src) ---")
    modules = ['src.sigma', 'src.netflex', 'src.tci', 'src.currency_converter', 'src.orkim', 'src.itk']
    all_ok = True
    for mod in modules:
        try:
            importlib.import_module(mod)
            print(f"[OK] Local Module: {mod}")
        except Exception as e:
            print(f"[FAIL] Local Module: {mod}")
            print(traceback.format_exc())
            all_ok = False
    return all_ok

def check_weasyprint():
    print("\n--- Checking WeasyPrint ---")
    try:
        from weasyprint import HTML
        print("[OK] WeasyPrint imported")
        # Try a simple render
        HTML(string="<h1>Test</h1>").write_pdf(target=None)
        print("[OK] WeasyPrint render test passed")
    except Exception as e:
        print(f"[FAIL] WeasyPrint check failed: {e}")
        print("Note: On Windows, WeasyPrint requires GTK3 to be installed and in PATH.")

def main():
    print(f"Python Version: {sys.version}")
    print(f"CWD: {os.getcwd()}")
    
    print("\n--- Checking Dependencies ---")
    deps = [
        'selenium', 'requests', 'openpyxl', 'dotenv', 'thefuzz', 
        'docx', 'googletrans', 'langdetect', 'chardet', 'weasyprint', 'num2words'
    ]
    for dep in deps:
        check_import(dep)

    check_src_modules()
    check_weasyprint()

    print("\n--- Checking Directories ---")
    for d in ['assets', 'src', 'bin']:
        if os.path.isdir(d):
            print(f"[OK] Directory exists: {d}")
        else:
            print(f"[WARN] Directory missing: {d}")

if __name__ == "__main__":
    main()
