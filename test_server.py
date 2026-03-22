# -*- coding: utf-8 -*-
"""
ExamFlow - Quick Diagnostic Test
Run this BEFORE app.py to check if everything is installed correctly.
Usage: python test_server.py
"""
import sys
import os

print("")
print("=" * 50)
print("  ExamFlow Diagnostic Test")
print("=" * 50)
print("")

# 1. Python version
print("[1] Python version: " + sys.version.split()[0])
if sys.version_info < (3, 8):
    print("    ERROR: Need Python 3.8 or newer")
    sys.exit(1)
else:
    print("    OK")

# 2. Check required packages
packages = [
    ("flask",               "Flask"),
    ("flask_sqlalchemy",    "Flask-SQLAlchemy"),
    ("flask_bcrypt",        "Flask-Bcrypt"),
    ("flask_jwt_extended",  "Flask-JWT-Extended"),
    ("flask_cors",          "Flask-CORS"),
    ("dotenv",              "python-dotenv"),
]
optional = [
    ("cv2",   "opencv-python-headless (optional)"),
    ("numpy", "numpy (optional)"),
    ("PIL",   "Pillow (optional)"),
]

print("")
print("[2] Checking required packages:")
all_ok = True
for mod, name in packages:
    try:
        __import__(mod)
        print("    OK  - " + name)
    except ImportError:
        print("    MISSING - " + name)
        print("           Run: pip install " + name.lower().replace("-", "_").split("(")[0].strip())
        all_ok = False

print("")
print("[3] Checking optional packages:")
for mod, name in optional:
    try:
        __import__(mod)
        print("    OK  - " + name)
    except ImportError:
        print("    skip - " + name + " (not required)")

# 3. Check port 5000 is free
print("")
print("[4] Checking if port 5000 is free:")
import socket
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1)
    result = s.connect_ex(("127.0.0.1", 5000))
    s.close()
    if result == 0:
        print("    WARNING: Port 5000 is already in use!")
        print("    Fix: Change port=5000 to port=5001 in app.py")
        print("    Then open http://localhost:5001")
    else:
        print("    OK - port 5000 is free")
except:
    print("    OK - port 5000 appears free")

# 4. Check app.py exists
print("")
print("[5] Checking files:")
for fname in ["app.py", "index.html"]:
    exists = os.path.exists(fname)
    print("    " + ("OK  - " if exists else "MISSING - ") + fname)
    if not exists:
        all_ok = False

print("")
if all_ok:
    print("=" * 50)
    print("  All checks passed!")
    print("  Run: python app.py")
    print("  Then open: http://localhost:5000")
    print("=" * 50)
else:
    print("=" * 50)
    print("  Fix the issues above then run: python app.py")
    print("=" * 50)

print("")
input("Press Enter to close...")
