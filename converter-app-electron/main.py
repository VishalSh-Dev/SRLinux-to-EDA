import webview
import sys
import os

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)

if __name__ == '__main__':
    html_file = resource_path('index.html')
    webview.create_window('SRLinux to EDA Converter', html_file, width=1200, height=800, min_size=(800, 600))
    webview.start()
