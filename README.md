# MediDrop: Automated Self-Service Pharmacy Dispenser

An IoT-driven, automated pharmacy dispenser designed to modernize public healthcare by eliminating severe outpatient congestion and preventing prescription fraud through secure dual-authentication.

Purpose
- Mitigate Long Wait Times: Resolves average outpatient pharmacy queues of 76 minutes down to a fraction of the time.
- Prevent Prescription Fraud: Replaces manual identity checks with multi-factor biometric and cryptographic verification.
- Touchless Dispensing: Automates independent, 24/7 medicine collection for outpatients and chronic refill cases.

Tech Stack
- Backend & API: Python, Flask (RESTful API), SQL
- Database & Management: MySQL, MySQL Workbench
- AI & Biometrics: ResNet-34 deep learning model, dlib (facial recognition & liveness detection)
- Security & Tokens: JSON Web Tokens (JWT) for cryptographically signed QR codes
- Hardware & IoT: ESP32 microcontroller, C++ firmware, servo motor (dispensing gate), load cell & HX711 module (weight verification)

Key Results
1. >99% Wait Time Reduction: Slashed average retrieval duration from 76 minutes to 43.9 seconds.
2. Zero Security Failure: Achieved a 0% False Acceptance Rate (FAR) during verification testing.
3. 1.36s Facial Recognition: High-speed biometric match under two seconds.
4. Exceptional Usability: Scored 96.5 on the System Usability Scale (SUS) ("Best Imaginable").
