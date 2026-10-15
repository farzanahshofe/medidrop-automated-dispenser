import numpy as np
import cv2
import face_recognition
import base64
import mysql.connector
from flask_cors import CORS
import secrets
import jwt
import datetime
import random
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from db import (
    verify_staff_login, verify_patient_login, update_staff_password,
    insert_patient, fetch_all_patients, search_patient_by_ic, fetch_patient_by_id,
    insert_doctor, fetch_all_doctors, fetch_doctor_by_code,
    insert_prescription, fetch_all_prescriptions, search_prescriptions_by_patient, fetch_active_prescriptions,
    fetch_prescriptions_by_doctor,
    verify_qr,
    insert_medicine, fetch_all_medicines,
    count_active_prescriptions, fetch_pending_prescriptions, verify_prescription_db, reject_prescription_db,
    fetch_history_prescriptions, fetch_prescriptions_by_status,
    fetch_all_pharmacists, insert_pharmacist, get_staff_code, add_staff_user, fetch_all_patients_admin, fetch_system_logs,
    dispense_item, open_drawer,
    log_auth_attempt, log_system_activity,
    fetch_all_prescriptions_pharmacist, fetch_history_prescriptions_pharmacist, search_prescription_by_code,
    verify_staff_credentials, verify_patient_credentials, update_patient_password, check_patient_email_exists
)

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)
app.permanent_session_lifetime = datetime.timedelta(hours=8)  # Sessions last 8 hours
CORS(app)  # Enable CORS on all routes
SECRET_KEY = "my_super_secret_pharmacy_key"

# --- Home route ---
@app.route('/')
def home():
    if 'user_id' in session:
        role = session.get('role')
        if role == 'Doctor':
            return redirect(url_for('doctor_dashboard'))
        elif role == 'Pharmacist':
            return redirect(url_for('pharmacist_dashboard'))
        elif role == 'Patient':
            return redirect(url_for('patient_dashboard'))
        elif role == 'Admin':
            return redirect(url_for('admin_dashboard'))
    return render_template('index.html')

# --- Facial Recognition API ---
@app.route('/verify_face', methods=['POST'])
def verify_face_api():
    data = request.json
    if 'image' not in data:
        return jsonify({"error": "No image provided"}), 400
    
    try:
        # Decode Base64
        if ',' in data['image']:
            encoded_data = data['image'].split(",")[1]
        else:
            encoded_data = data['image']
        nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Resize huge images for faster processing
        height, width = img.shape[:2]
        if width > 800:
            scaling_factor = 800 / float(width)
            img = cv2.resize(img, None, fx=scaling_factor, fy=scaling_factor, interpolation=cv2.INTER_AREA)


        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Detect face and get encoding
        captured_encodings = face_recognition.face_encodings(rgb_img)
        if not captured_encodings:
            return jsonify({"error": "No face detected in the image"}), 400
            
        captured_encoding = captured_encodings[0]

        # Compare with database encodings
        patients = fetch_all_patients()
        if not patients:
            print("DEBUG: No patients fetched from database.")
            return jsonify({"error": "No patients in database"}), 500

        print(f"DEBUG: Number of patients fetched: {len(patients)}")
        print(f"DEBUG: Captured encoding shape: {captured_encoding.shape}")

        known_encodings = [p['encoding'] for p in patients]
        print(f"DEBUG: Number of known encodings: {len(known_encodings)}")
        for i, encoding in enumerate(known_encodings):
            print(f"DEBUG: Known encoding {i} shape: {encoding.shape}")

        matches = face_recognition.compare_faces(known_encodings, captured_encoding, tolerance=0.45)
        print(f"DEBUG: Matches: {matches}")

        if True in matches:
            match_index = matches.index(True)
            patient = patients[match_index]  # get full patient dict
            log_system_activity('Patient', 'Face Scan', 'Success', patient_id=patient['patientID'], details="Face Recognized")
            # Clean up data for JSON response
            if 'encoding' in patient: del patient['encoding']
            if 'faceID' in patient: del patient['faceID']
            # active prescription count
            real_count = count_active_prescriptions(patient['patientID'])
            patient['activePrescriptions'] = real_count
            return jsonify(patient), 200
        else:
            log_system_activity('Unknown', 'Face Scan', 'Failed', details="Face Not Recognized")
            print("DEBUG: No matching face found.")
            return jsonify({"error": "Face not recognised"}), 401
        
    except Exception as e:
        log_auth_attempt(None, 'Face', 'Failed')
        print(e)
        return jsonify({"error": str(e)}), 500
    
# --- QR Verification API ---
@app.route('/verify_qr', methods=['POST'])
def verify_qr_api():
    data = request.json
    if 'patient_id' not in data or 'qr_string' not in data:
        return jsonify({"error": "Missing patient ID or QR code"}), 400
    
    result = verify_qr(data['patient_id'], data['qr_string'])

    if result["verified"]:
        log_system_activity('Patient', 'QR Scan', 'Success', patient_id=data['patient_id'], details="Prescription Verified")
        return jsonify({"verified": True, "prescription": result["prescription"]}), 200
    else:
        log_system_activity('Patient', 'QR Scan', 'Failed', patient_id=data.get('patient_id'), details=result["error"])
        return jsonify({"verified": False, "error": result["error"]}), 400

# --- Dispenser API ---
@app.route('/dispense_item', methods=['POST'])
def dispense_item_api():
    data = request.json
    if 'item_id' not in data:
        return jsonify({"error": "Item ID is required"}), 400
    
    success = dispense_item(data['item_id'])

    if success:
        return jsonify({
            "dispensed": True,
        }), 200
    else:
        return jsonify({
            "dispensed": False,
            "error": "Prescription not found or hardware error"
        }), 400
    
# Open drawer API
@app.route('/open_drawer', methods=['POST'])
def open_drawer_api():
    success = open_drawer()
    if success:
        return jsonify({"success": True, "message": "Drawer opened"}), 200
    else:
        return jsonify({"success": False, "error": "Failed to open drawer"}), 500

# Check pickup status API
@app.route('/check_pickup', methods=['GET'])
def check_pickup_api():
    from db import check_pickup_status
    is_empty = check_pickup_status()
    return jsonify({"picked_up": is_empty})

# Log landing page tap
@app.route('/log_landing_tap', methods=['POST'])
def log_landing_tap():
    log_system_activity('Unknown', 'Landing Page Tap', 'Success', details="Patient tapped landing page to begin dispenser session")
    return jsonify({"message": "Logged"}), 200

# --- Patient Management APIs ---
# Check if IC number exists
@app.route('/api/check_ic', methods=['POST'])
def check_ic_api():
    data = request.json
    ic = data.get('ic')
    if not ic:
        return jsonify({"error": "IC number is required"}), 400

    patient = search_patient_by_ic(ic)
    if patient:
        return jsonify({"exists": True, "message": "IC number has existed"}), 200
    else:
        return jsonify({"exists": False}), 200

# Check if email exists
@app.route('/api/check_email', methods=['POST'])
def check_email_api():
    data = request.json
    email = data.get('email')
    if not email:
        return jsonify({"error": "Email is required"}), 400

    exists = check_patient_email_exists(email)
    if exists:
        return jsonify({"exists": True, "message": "Email has existed"}), 200
    else:
        return jsonify({"exists": False}), 200

# Register new patient (with face image)
@app.route('/api/register_patient', methods=['POST'])
def register_patient_api():
    data = request.json
    try:
        name = data['name']
        ic = data['ic']
        phone = data['phone']
        email = data['email']
        password = data['password']
        image_b64 = data['image']

        # Extract birthdate from IC (first 6 digits: YYMMDD)
        yy = int(ic[:2])
        mm = int(ic[2:4])
        dd = int(ic[4:6])
        if yy > 50:
            year = 1900 + yy
        else:
            year = 2000 + yy
        birthdate = f"{year}-{mm:02d}-{dd:02d}"

        # Decode base64 image
        if ',' in image_b64:
            encoded_data = image_b64.split(",")[1]
        else:
            encoded_data = image_b64
        nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Detect face and get encoding
        captured_encodings = face_recognition.face_encodings(rgb_img)
        if not captured_encodings:
            return jsonify({"error": "No face detected in the image"}), 400
        face_encoding = captured_encodings[0]

        insert_patient(name, ic, birthdate, email, phone, face_encoding, password)
        return jsonify({"message": "Patient registered successfully"}), 201

    except mysql.connector.IntegrityError as e:
        if "Duplicate entry" in str(e):
            return jsonify({"error": "Patient with this email or IC number already exists"}), 400
        else:
            return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Add new patient (admin API)
@app.route('/add_patient', methods=['POST'])
def add_patient_api():
    data = request.json
    try:
        # Check if face_vector is provided
        if 'face_vector' in data:
            face_encoding = np.array(data['face_vector'])
        else:
            face_encoding = np.zeros(128)  # Default empty encoding

        insert_patient(
            data['name'],
            data['ic'],
            data['birthdate'],
            data['email'],
            data['phone'],
            face_encoding,
            data.get('password', '')  # Default empty if not provided
        )
        return jsonify({"message": "Patient added successfully"})

    except mysql.connector.IntegrityError as e:
        if "Duplicate entry" in str(e):
            return jsonify({"error": "Patient with this email or IC number already exists"}), 400
        else:
            return jsonify({"error": str(e)}), 500
        
# Fetch all patients
@app.route('/patients', methods=['GET'])
def get_patients_api():
   patients = fetch_all_patients()
   for p in patients:
       if 'encoding' in p:
           del p['encoding']
       if 'faceID' in p:
           del p['faceID']
   return jsonify(patients)
    
# Search patient by IC
@app.route('/search_patient', methods=['GET'])
def search_patient_api():
    ic = request.args.get('ic')
    if not ic:
        return jsonify({"error": "IC number is required"}), 400
    
    patient = search_patient_by_ic(ic)
    if patient:
        if 'encoding' in patient:
            del patient['encoding']
        if 'faceID' in patient:
            del patient['faceID']
        return jsonify(patient), 200
    else:
        return jsonify({"message": "Patient not found"}), 404

# --- Doctor Management APIs ---
# Add doctor
@app.route('/add_doctor', methods=['POST'])
def add_doctor_api():
    data = request.json
    try:
        doctor_id = insert_doctor(
            data['name'],
            data['dept'],
            data['email'],
            data['phone']
        )
        return jsonify({
            "message": "Doctor added successfully",
            "doctor_id": doctor_id
        }), 201
    
    except mysql.connector.IntegrityError as e:
        if "Duplicate entry" in str(e):
            return jsonify({"error": "Doctor with this email already exists"}), 400
        else:
            return jsonify({"error": str(e)}), 500
        
# Fetch all doctors
@app.route('/doctors', methods=['GET'])
def get_doctors_api():
    return jsonify(fetch_all_doctors())

# --- Prescription Management APIs ---
# Add prescription
@app.route('/add_prescription', methods=['POST'])
def add_prescription_api():
    if 'role' not in session or session['role'] != 'Doctor':
        return jsonify({"error": "Access denied"}), 403

    data = request.json

    if not data.get('patient_id') or not data.get('items'):
        return jsonify({"error": "Missing patient ID or prescription items"}), 400
        
    try:
        prescription_id = insert_prescription(
            patient_id=data['patient_id'],
            doctor_id=data['doctor_id'],
            items_list=data['items'],
            qr_string=data['qr_string']
        )

        if prescription_id:
            # Log prescription creation
            item_count = len(data['items'])
            username = session.get('name') if session.get('role') == 'Doctor' else None
            log_system_activity('Doctor', 'Prescription Bundle Created', 'Success',
                              username=username,
                              patient_id=data['patient_id'],
                              details=f"Prescribed {item_count} items for Patient {data['patient_id']}")
            return jsonify({"message": "Prescription added successfully", "prescriptionID": prescription_id}), 201
        else:
            return jsonify({"error": "Failed to add prescription"}), 500
        
    except Exception as e:
        print(f"Bundle Error: {e}")
        return jsonify({"error": str(e)}), 500

        return jsonify({"message": "Prescription added successfully", "prescriptionID": prescription_id}), 201

# Fetch all prescriptions
@app.route('/prescriptions', methods=['GET'])
def get_prescriptions_api():
    return jsonify(fetch_all_prescriptions())

# Search prescriptions by patient ID
@app.route('/search_prescriptions', methods=['GET'])
def search_prescriptions():
    patient_id = request.args.get('patientID')
    if not patient_id:
        return jsonify({"error": "Patient ID is required"}), 400

    prescriptions = search_prescriptions_by_patient(patient_id)
    if prescriptions:
        return jsonify(prescriptions)
    else:
        return jsonify({"message": "No prescriptions found for this patient"}), 404

# Fetch prescriptions by doctor ID
@app.route('/doctor_prescriptions', methods=['GET'])
def get_doctor_prescriptions():
    if 'role' not in session or session['role'] != 'Doctor':
        return jsonify({"error": "Access denied"}), 403

    code = session['name']
    formatted_code = code[:2] + "-" + code[2:]  # e.g., DR0001 -> DR-0001
    doctor = fetch_doctor_by_code(formatted_code)
    if not doctor:
        return jsonify({"error": "Doctor not found"}), 404

    prescriptions = fetch_prescriptions_by_doctor(doctor['doctorID'])

    # For testing: if no prescriptions, return dummy data
    if not prescriptions:
        prescriptions = [
            {
                'prescriptionID': 1,
                'prescCode': 'RX-000001',
                'status': 'Pending',
                'createdAt': '2023-01-01',
                'rejectionReason': None,
                'patientName': 'Test Patient',
                'patientIC': '900110141234',
                'doctorName': doctor['name'],
                'items': [
                    {
                        'medicineName': 'Test Medicine',
                        'genericName': 'Generic Name',
                        'strengthForm': '10mg Tablet',
                        'quantity': 30,
                        'direction': 'Take 1 tablet daily',
                        'indication': 'Pain Relief',
                        'refills': 0,
                        'supplyDays': 30
                    }
                ]
            },
            {
                'prescriptionID': 2,
                'prescCode': 'RX-000002',
                'status': 'Rejected',
                'createdAt': '2023-01-02',
                'rejectionReason': 'Invalid dosage',
                'patientName': 'Another Patient',
                'patientIC': '900220141235',
                'doctorName': doctor['name'],
                'items': [
                    {
                        'medicineName': 'Another Medicine',
                        'genericName': 'Another Generic',
                        'strengthForm': '20mg Capsule',
                        'quantity': 20,
                        'direction': 'Take 1 capsule twice daily',
                        'indication': 'Fever',
                        'refills': 1,
                        'supplyDays': 15
                    }
                ]
            }
        ]

    return jsonify(prescriptions)

# --- Medicine Management APIs ---
# Add medicine
@app.route('/add_medicines', methods=['POST'])
def add_medicines_api():
    data = request.json
    try:
        # Assuming insert_medicine function exists in db.py
        medicine_id = insert_medicine(
            data['name'],
            data['generic_name'],
            data['strength'],
            data['form'],
            data.get('stock_level', 0)
        )
        return jsonify({
            "message": "Medicine added successfully",
            "medicine_id": medicine_id
        }), 201

    except mysql.connector.IntegrityError as e:
        if "Duplicate entry" in str(e):
            return jsonify({"error": "Medicine with this name already exists"}), 400
        else:
            return jsonify({"error": str(e)}), 500

# Fetch all medicines
@app.route('/medicines', methods=['GET'])
def get_medicines_api():
    return jsonify(fetch_all_medicines())

# --- PHARMACIST ACTION APIS ---
@app.route('/api/pharmacist/all_prescriptions', methods=['GET'])
def get_all_prescriptions_api():
    if 'role' not in session or session['role'] != 'Pharmacist':
        return jsonify({"error": "Access denied"}), 403

    prescriptions = fetch_all_prescriptions_pharmacist()
    return jsonify(prescriptions)

# Approve & Sign Prescription
@app.route('/api/pharmacist/verify', methods=['POST'])
def pharmacist_verify_api():
    data = request.json
    presc_id = data.get('prescription_id')

    payload = {
        "prescription_id": presc_id,
        "nonce": random.randint(100000, 999999),
        "issued_at": str(datetime.datetime.now())
    }

    qr_token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')

    pharmacist_id = session.get('pharmacist_id')
    print(f"DEBUG: pharmacist_id from session: {pharmacist_id}")
    print(f"DEBUG: session data: {dict(session)}")

    if pharmacist_id is None:
        return jsonify({"error": "Pharmacist ID not found in session"}), 500

    if verify_prescription_db(presc_id, qr_token, pharmacist_id):
        log_system_activity('Pharmacist', 'Prescription Verified', 'Success',
                          username=session.get('name'),
                          details=f"Verified Prescription {presc_id}")
        return jsonify({"message": "Prescription Verified & Signed"}), 200
    else:
        return jsonify({"error": "Database Update Failed"}), 500
    
# Reject Prescription
@app.route('/api/pharmacist/reject', methods=['POST'])
def pharmacist_reject_api():
    data = request.json
    presc_id = data.get('prescription_id')
    reason = data.get('reason')

    pharmacist_id = session.get('pharmacist_id')
    print(f"DEBUG: pharmacist_id from session: {pharmacist_id}")
    print(f"DEBUG: session data: {dict(session)}")

    if pharmacist_id is None:
        return jsonify({"error": "Pharmacist ID not found in session"}), 500

    if reject_prescription_db(presc_id, reason, pharmacist_id):
        log_system_activity('Pharmacist', 'Prescription Rejected', 'Success',
                          username=session.get('name'),
                          details=f"Reason: {reason}")
        return jsonify({"message": "Prescription Rejected"}), 200
    else:
        return jsonify({"error": "Database Update Failed"}), 500

# --- AUTHENTICATION ROUTES ---
@app.route('/login')
def login_redirect(): return redirect(url_for('login_patient'))

@app.route('/login/patient', methods=['GET', 'POST'])
def login_patient():
    if request.method == 'POST':
        ic = request.form.get('username')
        pw = request.form.get('password')
        patient = verify_patient_login(ic, pw)

        if patient:
            log_system_activity('Patient', 'Web Login', 'Success', patient_id=patient['patientID'])
            session.permanent = True  # Make session permanent
            session['user_id'] = patient['patientID']
            session['role'] = 'Patient'
            session['name'] = patient['name']
            return redirect(url_for('patient_dashboard'))
        return render_template('login_patient.html', error="Invalid IC or Password")
    return render_template('login_patient.html')

@app.route('/login/staff', methods=['GET', 'POST'])
def login_staff():
    if request.method == 'POST':
        role = request.form.get('role')
        user_id = request.form.get('username')
        pw = request.form.get('password')

        user = verify_staff_login(user_id, pw)
        if user:
            log_system_activity(user['role'], 'Web Login', 'Success', username=user['username'])

            if user['role'] != role:
                return render_template('login_staff.html', is_admin=False, error=f"Access Denied. You are not a {role}.")

            session.permanent = True  # Make session permanent
            session['user_id'] = user['userID']
            session['role'] = user['role']
            session['name'] = user['username']

            # Get pharmacist ID if role is Pharmacist
            if user['role'] == 'Pharmacist':
                from db import get_pharmacist_id_by_user_id
                pharmacist_id = get_pharmacist_id_by_user_id(user['userID'])
                if pharmacist_id:
                    session['pharmacist_id'] = pharmacist_id

            # First time login password change enforcement
            if user.get('needsPasswordReset'):
                return redirect(url_for('force_password_reset'))

            if role == 'Doctor':
                return redirect(url_for('doctor_dashboard'))
            if role == 'Pharmacist':
                return redirect(url_for('pharmacist_dashboard'))
        
        else:
            log_system_activity('Unknown', 'Web Login', 'Failed', username=request.form.get('username'), details='Invalid Credentials')

        return render_template('login_staff.html', is_admin=False, error="Invalid Username or Password")

    # GET request - handle preselected role
    preselected_role = request.args.get('role', 'doctor').lower()  # Default to doctor
    return render_template('login_staff.html', is_admin=False, preselected_role=preselected_role)

@app.route('/login/admin', methods=['GET', 'POST'])
def login_admin():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        user = verify_staff_login(username, password)

        if user:
            if user['role'] != 'Admin':
                return render_template('login_staff.html', is_admin=True, error="Access Denied. Not an Admin.")
            
            session.permanent = True  # Make session permanent
            session['user_id'] = user['userID']
            session['role'] = user['role']
            session['name'] = user['username']

            return redirect(url_for('admin_dashboard'))
        
        return render_template('login_staff.html', is_admin=True, error="Invalid Username or Password")
    
    return render_template('login_staff.html', is_admin=True)

@app.route('/force_password_reset', methods=['GET', 'POST'])
def force_password_reset():
    if 'user_id' not in session:
        return redirect(url_for('login_staff'))

    if request.method == 'POST':
        new_pass = request.form.get('new_password')
        confirm_pass = request.form.get('confirm_password')

        if not new_pass or not confirm_pass:
            return render_template('reset_password.html', error="Please fill in all fields.")

        if new_pass != confirm_pass:
            return render_template('reset_password.html', error="Passwords do not match.")

        # Validate password strength requirements
        requirements = {
            'length': len(new_pass) >= 8,
            'uppercase': any(c.isupper() for c in new_pass),
            'lowercase': any(c.islower() for c in new_pass),
            'number': any(c.isdigit() for c in new_pass),
            'symbol': any(c in '.!@#$%^&*' for c in new_pass)
        }

        if not all(requirements.values()):
            return render_template('reset_password.html', error="Password does not meet requirements.")

        if update_staff_password(session['user_id'], new_pass):
            # Clear session to force re-login
            session.clear()
            return redirect(url_for('login_staff'))
        return render_template('reset_password.html', error="Failed to update password. Try again.")
    return render_template('reset_password.html')

# --- PASSWORD RESET ROUTES ---
@app.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        staff_code = request.form.get('staff_code').strip().upper()
        email = request.form.get('email').strip()

        if not staff_code or not email:
            return render_template('forgot_password.html', error="Please fill in all fields.")

        # Verify credentials
        staff_info = verify_staff_credentials(staff_code, email)
        if not staff_info:
            return render_template('forgot_password.html', error="Invalid staff code or email combination.")

        # Store staff info in session for password reset
        session['reset_user_id'] = staff_info['userID']
        session['reset_role'] = staff_info['role']
        session['reset_name'] = staff_info['name']

        return redirect(url_for('reset_password'))

    return render_template('forgot_password.html')

@app.route('/forgot_password_patient', methods=['GET', 'POST'])
def forgot_password_patient():
    if request.method == 'POST':
        ic_number = request.form.get('ic_number').strip()
        email = request.form.get('email').strip()

        if not ic_number or not email:
            return render_template('forgot_password_patient.html', error="Please fill in all fields.")

        # Verify credentials
        patient_info = verify_patient_credentials(ic_number, email)
        if not patient_info:
            return render_template('forgot_password_patient.html', error="Invalid IC number or email combination.")

        # Store patient info in session for password reset
        session['reset_patient_id'] = patient_info['patientID']
        session['reset_patient_name'] = patient_info['name']

        return redirect(url_for('reset_password'))

    return render_template('forgot_password_patient.html')

@app.route('/reset_password', methods=['GET', 'POST'])
def reset_password():
    # Check if either staff or patient reset session exists
    if 'reset_user_id' not in session and 'reset_patient_id' not in session:
        return redirect(url_for('forgot_password'))

    if request.method == 'POST':
        new_password = request.form.get('new_password')
        confirm_password = request.form.get('confirm_password')

        if not new_password or not confirm_password:
            return render_template('reset_password.html', error="Please fill in all fields.")

        if new_password != confirm_password:
            return render_template('reset_password.html', error="Passwords do not match.")

        # Validate password strength requirements
        requirements = {
            'length': len(new_password) >= 8,
            'uppercase': any(c.isupper() for c in new_password),
            'lowercase': any(c.islower() for c in new_password),
            'number': any(c.isdigit() for c in new_password),
            'symbol': any(c in '.!@#$%^&*' for c in new_password)
        }

        if not all(requirements.values()):
            return render_template('reset_password.html', error="Password does not meet requirements.")

        # Update password based on user type
        success = False
        if 'reset_user_id' in session:
            # Staff password reset
            print(f"DEBUG: Session data: {dict(session)}")
            print(f"DEBUG: Attempting password reset for user_id: {session['reset_user_id']} (type: {type(session['reset_user_id'])})")
            success = update_staff_password(session['reset_user_id'], new_password)
            print(f"DEBUG: Password reset success: {success}")
            if success:
                print("DEBUG: Password reset was successful, clearing session and redirecting")
                # Log the password reset
                role = session.get('reset_role', 'Doctor')  # Default to Doctor if not set
                log_system_activity(role, 'Password Reset', 'Success',
                                  username=session.get('reset_name'), details="Password reset via forgot password")
                # Clear reset session
                session.pop('reset_user_id', None)
                session.pop('reset_role', None)
                session.pop('reset_name', None)
                # Redirect to staff login with role
                return redirect(url_for('login_staff', role=role.lower()))
            else:
                print("DEBUG: Password reset failed")

        elif 'reset_patient_id' in session:
            # Patient password reset
            success = update_patient_password(session['reset_patient_id'], new_password)
            if success:
                # Log the password reset
                log_system_activity('Patient', 'Password Reset', 'Success',
                                  patient_id=session['reset_patient_id'],
                                  details="Password reset via forgot password")
                # Clear reset session
                session.pop('reset_patient_id', None)
                session.pop('reset_patient_name', None)
                # Redirect to patient login
                return redirect(url_for('login_patient'))

        if not success:
            return render_template('reset_password.html', error="Failed to reset password. Please try again.")

    return render_template('reset_password.html')

@app.route('/logout')
def logout():
    role = session.get('role')
    session.clear()
    if role == 'Patient':
        return redirect(url_for('login_patient'))
    elif role == 'Admin':
        return redirect(url_for('login_admin'))
    elif role in ['Doctor', 'Pharmacist']:
        return redirect(url_for('login_staff', role=role.lower()))
    else:
        return redirect(url_for('home'))

@app.route('/register')
def register():
    return render_template(('register.html'))

@app.route('/landing')
def landing():
    return render_template('landing.html')

# --- DASHBOARD ROUTES ---
@app.route('/doctor/dashboard')
def doctor_dashboard():
    if 'role' not in session or session['role'] != 'Doctor':
        return redirect(url_for('login_staff'))
    
    code = session['name']
    formatted_code = code[:2] + "-" + code[2:]  # e.g., DR0001 -> DR-0001
    
    doctor = fetch_doctor_by_code(formatted_code)
    medicines = fetch_all_medicines()

    return render_template('doctor_dashboard.html', doctor=doctor, medicines=medicines)

@app.route('/pharmacist/dashboard')
def pharmacist_dashboard():
    if 'role' not in session or session['role'] != 'Pharmacist':
        return redirect(url_for('login_staff'))

    tab = request.args.get('tab', 'pending')
    search = request.args.get('search', '').strip()

    if search:
        prescriptions = search_prescription_by_code(search)
    elif tab == 'all':
        prescriptions = fetch_all_prescriptions_pharmacist()
    elif tab == 'history':
        prescriptions = fetch_history_prescriptions_pharmacist()
    else:  # default to pending
        prescriptions = fetch_pending_prescriptions()

    return render_template('pharmacist_dashboard.html', prescriptions=prescriptions, active_tab=tab, search_query=search)

@app.route('/patient/dashboard')
def patient_dashboard():
    if 'role' not in session or session['role'] != 'Patient':
        return redirect(url_for('login_patient'))
    
    patient_id = session['user_id']
    patient = fetch_patient_by_id(patient_id)

    view_mode = request.args.get('view', 'active')
    if view_mode == 'history':
        prescriptions = fetch_history_prescriptions(patient_id)
    else:
        prescriptions = fetch_active_prescriptions(patient_id)

    return render_template('patient_dashboard.html', patient=patient, prescriptions=prescriptions, view_mode=view_mode)

@app.route('/admin/dashboard')
def admin_dashboard():
    if 'role' not in session or session['role'] != 'Admin':
        return redirect(url_for('login_staff'))

    doctors = fetch_all_doctors()
    pharmacists = fetch_all_pharmacists()
    patients = fetch_all_patients_admin()
    logs = fetch_system_logs()

    stats = {
        'patients': len(patients),
        'doctors': len(doctors),
        'pharmacists': len(pharmacists)
    }

    return render_template('admin_dashboard.html', doctors=doctors, pharmacists=pharmacists, stats=stats, patients=patients, logs=logs)

# --- ADMIN API ---
@app.route('/admin/logs')
def get_logs_api():
    if 'role' not in session or session['role'] != 'Admin':
        return jsonify({"error": "Access denied"}), 403

    logs = fetch_system_logs()
    return jsonify(logs)

@app.route('/admin/add_staff', methods=['POST'])
def add_staff_api():
    if session.get('role') != 'Admin':
        return jsonify({"error": "Access denied"}), 403
    
    data = request.json
    role = data.get('role')
    name = data.get('name')
    email = data.get('email')
    phone = data.get('phone')
    dept = data.get('department')

    try:
        staff_code = None

        if role == 'Doctor':
            new_id = insert_doctor(name, dept, email, phone)
            staff_code = get_staff_code('doctors', 'doctorID', new_id, 'doctorCode')

        elif role == 'Pharmacist':
            new_id = insert_pharmacist(name, email, phone)
            staff_code = get_staff_code('pharmacists', 'pharmacistID', new_id, 'pharmacistCode')

        if staff_code:
            result = add_staff_user(staff_code, role)

            if result['success']:
                return jsonify({
                    "message": "Staff Created Successfully",
                    "details": {
                        "name": name,
                        "username": result['username'],
                        "password": result['default_pass']
                    }
                }), 201
            else:
                return jsonify({"error": "Profile created but failed to create login credentials" + result.get('error')}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    return jsonify({"error": "Unknown Error"}), 500

# --- Run the Flask app ---
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')