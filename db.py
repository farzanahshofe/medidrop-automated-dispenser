import os
import json
import requests
from dotenv import load_dotenv
import mysql.connector
import numpy as np
from datetime import date, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

# Load environment variables from .env file
load_dotenv()

# Read DB credentials from environment variables
DB_HOST = os.getenv('DB_HOST')
DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_NAME = os.getenv('DB_NAME')
ESP32_HOST = os.getenv('ESP32_HOST')

# Database connection function
def get_db_connection():
    test_db_name = os.getenv('TEST_DB_NAME', os.getenv('DB_NAME'))
    return mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=test_db_name
    )

# --- PATIENT FUNCTIONS ---

# Insert patient with face encoding (JSON string)
def insert_patient(name, ic, birthdate, email, phone, face_encoding_np, password):
    connection = get_db_connection()
    cursor = connection.cursor()

    # Convert numpy array to JSON string
    encoding_json = json.dumps(face_encoding_np.tolist())

    hashed_password = generate_password_hash(password)

    query = """
    INSERT INTO patients (name, ICnumber, birthdate, email, phoneNumber, faceID, passwordHash)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    cursor.execute(query, (name, ic, birthdate, email, phone, encoding_json, hashed_password))
    connection.commit()

    cursor.close()
    connection.close()

# Fetch All Patients with Encodings 
def fetch_all_patients():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
    SELECT patientID, patientCode, name, ICnumber, birthdate, email, phoneNumber, faceID 
    FROM patients"""
    cursor.execute(query)
    rows = cursor.fetchall()

    results = []
    for row in rows:
        if row['faceID']:
            try:
                # Convert JSON string back to numpy array
                encoding_list = json.loads(row['faceID'])
                row['encoding'] = np.array(encoding_list)
                results.append(row)
            except:
                continue

    cursor.close()
    connection.close()
    return results

# Search patient by IC
def search_patient_by_ic(ic):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
    SELECT patientID, name, ICnumber, birthdate, email, phoneNumber, faceID
    FROM patients WHERE ICnumber = %s
    """
    cursor.execute(query, (ic,))
    result = cursor.fetchone()

    # Convert faceID to numpy array if exists
    if result and result['faceID']:
        try:
            result['encoding'] = np.array(json.loads(result['faceID']))
        except:
            pass # keep it as is if conversion fails

    cursor.close()
    connection.close()
    return result

# Fetch patient by ID
def fetch_patient_by_id(patient_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
    SELECT patientID, patientCode, name, ICnumber, birthdate, email, phoneNumber
    FROM patients WHERE patientID = %s
    """
    cursor.execute(query, (patient_id,))
    result = cursor.fetchone()

    cursor.close()
    connection.close()
    return result

# --- DOCTOR FUNCTIONS ---
# Insert doctor
def insert_doctor(name, dept, email, phone):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        # Generate doctorCode first (e.g., DR-0001, DR-0002, etc.)
        # We need to get the next ID by checking current max
        cursor.execute("SELECT COALESCE(MAX(doctorID), 0) + 1 FROM doctors")
        next_id = cursor.fetchone()[0]
        doctor_code = f"DR-{next_id:04d}"

        # Create user account first
        username = doctor_code.replace("-", "")  # Remove hyphens from username
        raw_password = f"A{username}"
        password_hash = generate_password_hash(raw_password)

        print(f"Creating user: username={username}, password={raw_password}")

        cursor.execute("""
            INSERT INTO users (username, passwordHash, role, needsPasswordReset)
            VALUES (%s, %s, 'Doctor', TRUE)
        """, (username, password_hash))

        user_id = cursor.lastrowid
        print(f"User created with ID: {user_id}")

        # Now create doctor record with userID
        query = """
        INSERT INTO doctors (name, department, email, phoneNumber, doctorCode, userID)
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (name, dept, email, phone, doctor_code, user_id))

        doctor_id = cursor.lastrowid
        print(f"Doctor created with ID: {doctor_id}")
        connection.commit()

        return doctor_id

    except Exception as e:
        connection.rollback()
        print(f"Error creating doctor: {e}")
        return None
    finally:
        cursor.close()
        connection.close()

# Get all doctors
def fetch_all_doctors():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = "SELECT * FROM doctors"
    cursor.execute(query)
    rows = cursor.fetchall()

    cursor.close()
    connection.close()
    return rows

# Fetch doctor by code
def fetch_doctor_by_code(doctor_code):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
    SELECT * FROM doctors WHERE doctorCode = %s
    """
    cursor.execute(query, (doctor_code,))
    doctor = cursor.fetchone()

    cursor.close()
    connection.close()
    return doctor

# --- MEDICINE FUNCTIONS ---
# Insert medicine
def insert_medicine(name, generic_name, strength, form, pack_size, stock_level):
    connection = get_db_connection()
    cursor = connection.cursor()

    query = """
    INSERT INTO medicines (name, genericName, strength, form, packSize, stockLevel)
    VALUES (%s, %s, %s, %s, %s, %s)
    """
    cursor.execute(query, (name, generic_name, strength, form, pack_size, stock_level))
    connection.commit()

    medicine_id = cursor.lastrowid
    cursor.close()
    connection.close()
    return medicine_id

# Get all medicines
def fetch_all_medicines():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = "SELECT * FROM medicines"
    cursor.execute(query)
    rows = cursor.fetchall()

    cursor.close()
    connection.close()
    return rows

# --- PRESCRIPTION FUNCTIONS ---
# insert prescription
def insert_prescription(patient_id, doctor_id, items_list, qr_string):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        # 1. Insert prescription header
        header_query = """
            INSERT INTO prescriptions (patientID, doctorID, QRcode, status)
            VALUES (%s, %s, %s, 'Pending')
        """

        cursor.execute(header_query, (patient_id, doctor_id, qr_string))
        prescription_id = cursor.lastrowid

        # Generate prescCode
        presc_code = f"RX-{prescription_id:05d}"
        cursor.execute("UPDATE prescriptions SET prescCode = %s WHERE prescriptionID = %s",
                       (presc_code, prescription_id))

        # 2. Insert medicine items
        item_query = """
            INSERT INTO prescription_items
            (prescriptionID, medicineID, quantity, supplyDays, direction, indication, refills)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """

        data_tuples = []
        for item in items_list:
            data_tuples.append((
                prescription_id,
                item['medicine_id'],
                item['quantity'],
                item['supply_days'],
                item['direction'],
                item['indication'],
                item['refills']
            ))

        cursor.executemany(item_query, data_tuples)
        connection.commit()

        return prescription_id
    
    except Exception as e:
        print(f"DB Error: {e}")
        connection.rollback()
        return None
    finally:
        cursor.close()
        connection.close()

#get all prescriptions
def fetch_all_prescriptions():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT
            p.prescriptionID, p.prescCode, p.status, p.createdAt,
            pt.name AS patientName, d.name AS doctorName
        FROM prescriptions p
        JOIN patients pt ON p.patientID = pt.patientID
        JOIN doctors d ON p.doctorID = d.doctorID
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    cursor.close()
    connection.close()
    return rows

# search prescriptions by patient ID
def search_prescriptions_by_patient(patient_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT
            p.prescriptionID, p.prescCode, p.status, p.createdAt,
            pt.name AS patientName, d.name AS doctorName
        FROM prescriptions p
        JOIN patients pt ON p.patientID = pt.patientID
        JOIN doctors d ON p.doctorID = d.doctorID
        WHERE p.patientID = %s
    """
    cursor.execute(query, (patient_id,))
    rows = cursor.fetchall()
    cursor.close()
    connection.close()
    return rows

# fetch prescriptions by doctor ID
def fetch_prescriptions_by_doctor(doctor_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT
            p.prescriptionID, p.prescCode, p.status, p.createdAt, p.rejectionReason, p.verifiedBy,
            pt.name AS patientName, pt.ICnumber AS patientIC,
            d.name AS doctorName,
            ph.name AS pharmacistName
        FROM prescriptions p
        JOIN patients pt ON p.patientID = pt.patientID
        JOIN doctors d ON p.doctorID = d.doctorID
        LEFT JOIN pharmacists ph ON p.verifiedBy = ph.pharmacistID
        WHERE p.doctorID = %s
        ORDER BY p.createdAt DESC
    """
    cursor.execute(query, (doctor_id,))
    headers = cursor.fetchall()

    for h in headers:
        item_query = """
            SELECT
                m.name AS medicineName, m.genericName, m.packSize,
                CONCAT(m.strength, ' ', m.form) AS strengthForm,
                i.quantity, i.direction, i.indication, i.refills, i.supplyDays
            FROM prescription_items i
            JOIN medicines m ON i.medicineID = m.medicineID
            WHERE i.prescriptionID = %s
        """
        cursor.execute(item_query, (h['prescriptionID'],))
        h['items'] = cursor.fetchall()

        if isinstance(h['createdAt'], date):
            h['createdAt'] = h['createdAt'].strftime("%Y-%m-%d")

    cursor.close()
    connection.close()
    return headers

# fetch active prescriptions for a patient
def fetch_active_prescriptions(patient_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    header_query = """
        SELECT
            p.prescriptionID, p.prescCode, p.status, p.QRcode, p.createdAt,
            d.name AS doctorName
        FROM prescriptions p
        JOIN doctors d ON p.doctorID = d.doctorID
        WHERE p.patientID = %s AND p.status IN ('Pending', 'Verified', 'Active')
        ORDER BY p.createdAt DESC
    """
    cursor.execute(header_query, (patient_id,))
    headers = cursor.fetchall()

    for h in headers:
        item_query = """
            SELECT
                m.name AS medicineName, m.genericName, m.packSize,
                CONCAT(m.strength, ' ', m.form) AS strengthForm,
                i.quantity, i.direction, i.indication, i.refills, i.supplyDays, i.lastCollectedDate
            FROM prescription_items i
            JOIN medicines m ON i.medicineID = m.medicineID
            WHERE i.prescriptionID = %s
        """
        cursor.execute(item_query, (h['prescriptionID'],))
        h['items'] = cursor.fetchall()

        if isinstance(h['createdAt'], date):
            h['createdAt'] = h['createdAt'].strftime("%Y-%m-%d")

        # Calculate nextPickupDate for Active prescriptions (7 days before actual due date)
        if h['status'] == 'Active':
            next_pickup_date = None

            for item in h['items']:
                if item['refills'] > 0 and item['lastCollectedDate']:
                    due_date = item['lastCollectedDate'] + timedelta(days=item['supplyDays'])
                    pickup_date = due_date - timedelta(days=7)  # Allow pickup 7 days before due date
                    if next_pickup_date is None or pickup_date < next_pickup_date:
                        next_pickup_date = pickup_date

            if next_pickup_date:
                h['nextPickupDate'] = next_pickup_date.strftime("%d %b %Y")

    cursor.close()
    connection.close()
    return headers

# Fetch old prescriptions
def fetch_history_prescriptions(patient_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT
            p.prescriptionID, p.prescCode, p.status, p.QRcode, p.createdAt,
            d.name AS doctorName
        FROM prescriptions p
        JOIN doctors d ON p.doctorID = d.doctorID
        WHERE p.patientID = %s AND p.status IN ('Completed', 'Rejected')
        ORDER BY p.createdAt DESC
    """
    cursor.execute(query, (patient_id,))
    headers = cursor.fetchall()

    for h in headers:
        # Now we get the medicine details from the ITEMS table
        item_query = """
            SELECT
                m.name AS medicineName, m.genericName, m.packSize,
                CONCAT(m.strength, ' ', m.form) AS strengthForm,
                i.quantity, i.direction, i.indication,
                i.refills, i.supplyDays, i.lastCollectedDate
            FROM prescription_items i
            JOIN medicines m ON i.medicineID = m.medicineID
            WHERE i.prescriptionID = %s
        """
        cursor.execute(item_query, (h['prescriptionID'],))
        h['items'] = cursor.fetchall()
        
        # Format Date
        if h['createdAt']:
            h['createdAt'] = h['createdAt'].strftime('%d %b %Y')

    cursor.close()
    connection.close()
    return headers

# Count active prescriptions for a patient
def count_active_prescriptions(patient_id):
    connection = get_db_connection()
    cursor = connection.cursor()

    query = """
    SELECT COUNT(*) FROM prescriptions
    WHERE patientID = %s
    AND status IN ('Verified', 'Active')
    """

    cursor.execute(query, (patient_id,))
    count = cursor.fetchone()[0]

    cursor.close()
    connection.close()
    return count

# Fetch prescription by status
def fetch_prescriptions_by_status(patient_id, status_list):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    placeholders = ','.join(['%s'] * len(status_list))
    header_query = f"""
        SELECT
            p.prescriptionID, p.prescCode, p.status, p.QRcode, p.createdAt,
            d.name AS doctorName
        FROM prescriptions p
        JOIN doctors d ON p.doctorID = d.doctorID
        WHERE p.patientID = %s AND p.status IN ({placeholders})
        ORDER BY p.createdAt DESC
    """
    # Create parameters tuple
    params = [patient_id] + status_list
    cursor.execute(header_query, tuple(params))
    headers = cursor.fetchall()

    for h in headers:
        item_query = """
            SELECT
                m.name AS medicineName, m.genericName, m.packSize, m.purpose,
                CONCAT(m.strength, ' ', m.form) AS strengthForm,
                i.quantity, i.direction, i.indication, i.refills, i.supplyDays, i.lastCollectedDate
            FROM prescription_items i
            JOIN medicines m ON i.medicineID = m.medicineID
            WHERE i.prescriptionID = %s
        """
        cursor.execute(item_query, (h['prescriptionID'],))
        h['items'] = cursor.fetchall()

        if isinstance(h['createdAt'], date):
            h['createdAt'] = h['createdAt'].strftime("%Y-%m-%d")

    cursor.close()
    connection.close()
    return headers

# Verify QR (encrypted compare)
def verify_qr(patient_id, qr_string):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    # 1. Fetch prescription header
    header_query = """
        SELECT
            p.prescriptionID, p.prescCode, p.status, p.createdAt,
            d.name AS doctorName, pt.name AS patientName,
            ph.name AS pharmacistName
        FROM prescriptions p
        JOIN doctors d ON p.doctorID = d.doctorID
        JOIN patients pt ON p.patientID = pt.patientID
        LEFT JOIN pharmacists ph ON p.verifiedBy = ph.pharmacistID
        WHERE p.patientID = %s AND p.QRcode = %s
    """
    cursor.execute(header_query, (patient_id, qr_string))
    header = cursor.fetchone()

    if not header:
        cursor.close()
        connection.close()
        return {"verified": False, "error": "Prescription not found."}
    
    # 2. Status Checks
    if header['status'] == 'Pending':
        return {"verified": False, "error": "Prescription not yet verified by Pharmacist."}
    if header['status'] == 'Rejected':
        return {"verified": False, "error": "Prescription has been rejected by Pharmacist."}
    if header['status'] == 'Completed':
        return {"verified": False, "error": "Prescription fully collected."}
    
    #3. Fetch prescription items
    items_query = """
        SELECT
            i.itemID, m.name AS medicineName, m.genericName, m.packSize,
            CONCAT(m.strength, ' ', m.form) AS strengthForm,
            i.quantity, i.direction, i.indication, i.refills, i.lastCollectedDate, i.supplyDays
        FROM prescription_items i
        JOIN medicines m ON i.medicineID = m.medicineID
        WHERE i.prescriptionID = %s
    """

    cursor.execute(items_query, (header['prescriptionID'],))
    items = cursor.fetchall()
    cursor.close()
    connection.close()

    # 4. Filter items based on rules
    collectible_items = []

    # If verified, all items are collectible
    if header['status'] == 'Verified':
        collectible_items = items
    elif header['status'] == 'Active':
        # only show items that are due
        from datetime import date, timedelta
        today = date.today()

        for item in items:
            if item['refills'] > 0 and item['lastCollectedDate']:
                due_date = item['lastCollectedDate'] + timedelta(days=item['supplyDays'])
                allowed_date = due_date - timedelta(days=7)  # 7-day grace period

                if today >= allowed_date:
                    collectible_items.append(item)

    if not collectible_items and header['status'] == 'Active':
        # Calculate next pickup date for Active prescriptions (7 days before actual due date)
        from datetime import date, timedelta
        today = date.today()
        next_pickup_date = None

        for item in items:
            if item['refills'] > 0 and item['lastCollectedDate']:
                due_date = item['lastCollectedDate'] + timedelta(days=item['supplyDays'])
                pickup_date = due_date - timedelta(days=7)  # Allow pickup 7 days before due date
                if pickup_date > today:
                    if next_pickup_date is None or pickup_date < next_pickup_date:
                        next_pickup_date = pickup_date

        next_pickup_date_str = next_pickup_date.strftime("%d %b %Y") if next_pickup_date else None

        return {
            "verified": False,
            "error": "No items available for collection today.",
            "nextPickupDate": next_pickup_date_str
        }
    
    return {
        "verified": True,
        "prescription": {
            "prescriptionID": header['prescriptionID'],
            "prescCode": header['prescCode'],
            "doctorName": header['doctorName'],
            "pharmacistName": header['pharmacistName'] or "Not Verified",
            "prescribedDate": header['createdAt'].strftime("%Y-%m-%d %H:%M"),
            "medications": collectible_items
        }
    }

# Check if the drawer is empty via ESP32 Sensor
def check_pickup_status():
    try:
        url = f"http://{ESP32_HOST}/status"
        response = requests.get(url, timeout=2)
        data = response.json()
        
        # Assuming 'is_empty' is sent, or check 'weight' < 5.0
        is_empty = data.get('is_empty', False) 
        
        if not is_empty and 'weight' in data:
            # Fallback if ESP32 doesn't send boolean
            is_empty = float(data['weight']) < 5.0 

        return is_empty
        
    except Exception as e:
        print(f"Sensor Check Error: {e}")
        return False # Assume not empty if error, to be safe
    
# Dispense prescription
def dispense_item(item_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT i.*, p.status as mainStatus, p.patientID, m.name as medicineName
        FROM prescription_items i
        JOIN prescriptions p ON i.prescriptionID = p.prescriptionID
        JOIN medicines m ON i.medicineID = m.medicineID
        WHERE i.itemID = %s
    """

    cursor.execute(query, (item_id,))
    item = cursor.fetchone()

    if not item: 
        cursor.close()
        connection.close()
        return False
    

    print(f"Internal Dispense: Processing Item {item_id} in Database...")

    try:
        # A. Update medicine stock
        cursor.execute("UPDATE medicines SET stockLevel = stockLevel - %s WHERE medicineID = %s",
                        (item['quantity'], item['medicineID']))
        
        # B. Update status
        if item['mainStatus'] == 'Verified':
            cursor.execute("UPDATE prescriptions SET status = 'Active' WHERE prescriptionID = %s",
                           (item['prescriptionID'],))
            cursor.execute("UPDATE prescription_items SET lastCollectedDate = CURDATE() WHERE itemID = %s",
                           (item_id,))

        elif item['mainStatus'] == 'Active':
            if item['refills'] > 0:
                new_refills = item['refills'] - 1
                cursor.execute("UPDATE prescription_items SET refills = %s, lastCollectedDate = CURDATE() WHERE itemID = %s",
                            (new_refills, item_id))

        # C. Check if prescription is completed
        pid = item['prescriptionID']
        cursor.execute("SELECT SUM(refills) as total_remaining FROM prescription_items WHERE prescriptionID = %s",
                       (pid,))
        result = cursor.fetchone()
        total_remaining = result['total_remaining'] if result['total_remaining'] is not None else 0

        if total_remaining == 0:
            cursor.execute("UPDATE prescriptions SET status = 'Completed' WHERE prescriptionID = %s",
                           (pid,))

        # D. History
        current_refills = item.get('refills', 0)
        remaining = current_refills -1 if item['mainStatus'] == 'Active' else current_refills
        cursor.execute("INSERT INTO dispense_history (itemID, refillsRemaining) VALUES (%s, %s)",
                       (item_id, remaining))

        connection.commit()

        # E. Log the dispense event
        log_system_activity('Patient', 'Medication Dispensed', 'Success',
                          patient_id=item['patientID'],
                          details=f"Dispensed {item['medicineName']} (Item ID: {item_id})")

        # Log as auth attempt for dispense
        log_auth_attempt(item['patientID'], 'Dispense', 'Success')

        return True
    
    except Exception as e:
        print(f"DB Error during dispense: {e}")
        connection.rollback()
        return False
    finally:
        cursor.close()
        connection.close()

# Open bin via ESP32
def open_drawer():
    print(f"Sending Signal: OPEN DRAWER to {ESP32_HOST}...")
    try:
        url = f"http://{ESP32_HOST}/open"
        response = requests.get(url, timeout=5)

        if response.status_code == 200:
            print("Hardware Success: Drawer Opened.")
            return True
        else:
            print(f"Hardware Error: Status Code {response.status_code}")
            return False
        
    except Exception as e:
        print(f"Error communicating with ESP32: {e}")
        return False

# --- PHARMACIST FUNCTIONS ---
def insert_pharmacist(name, email, phone):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        # Generate pharmacistCode first (e.g., PHARM-0001, PHARM-0002, etc.)
        # We need to get the next ID by checking current max
        cursor.execute("SELECT COALESCE(MAX(pharmacistID), 0) + 1 FROM pharmacists")
        next_id = cursor.fetchone()[0]
        pharmacist_code = f"PHARM-{next_id:04d}"

        # Create user account first
        username = pharmacist_code.replace("-", "")  # Remove hyphens from username
        raw_password = f"A{username}"
        password_hash = generate_password_hash(raw_password)

        cursor.execute("""
            INSERT INTO users (username, passwordHash, role, needsPasswordReset)
            VALUES (%s, %s, 'Pharmacist', TRUE)
        """, (username, password_hash))

        user_id = cursor.lastrowid

        # Now create pharmacist record with userID
        query = """
        INSERT INTO pharmacists (name, email, phoneNumber, pharmacistCode, userID)
        VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(query, (name, email, phone, pharmacist_code, user_id))

        pid = cursor.lastrowid
        connection.commit()

        return pid

    except Exception as e:
        connection.rollback()
        print(f"Error creating pharmacist: {e}")
        return None
    finally:
        cursor.close()
        connection.close()

def fetch_pharmacist_by_id(pid):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
    SELECT * FROM pharmacists WHERE pharmacistID = %s
    """
    cursor.execute(query, (pid,))
    pharmacist = cursor.fetchone()

    cursor.close()
    connection.close()
    return pharmacist

def fetch_all_pharmacists():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = "SELECT * FROM pharmacists"
    cursor.execute(query)
    rows = cursor.fetchall()

    cursor.close()
    connection.close()
    return rows

def fetch_pending_prescriptions():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT
            p.prescriptionID, p.prescCode, p.createdAt, p.status, p.rejectionReason,
            pt.name AS patientName, pt.ICnumber,
            d.name AS doctorName
        FROM prescriptions p
        JOIN patients pt ON p.patientID = pt.patientID
        JOIN doctors d ON p.doctorID = d.doctorID
        WHERE p.status = 'Pending'
        ORDER BY p.createdAt ASC
    """
    cursor.execute(query)
    headers = cursor.fetchall()

    # get items for each prescription
    for h in headers:
        item_query = """
            SELECT
                m.name, m.strength, m.form, m.packSize,
                i.quantity, i.direction, i.indication, i.supplyDays
            FROM prescription_items i
            JOIN medicines m ON i.medicineID = m.medicineID
            WHERE i.prescriptionID = %s
        """
        cursor.execute(item_query, (h['prescriptionID'],))
        h['items'] = cursor.fetchall()

    cursor.close()
    connection.close()
    return headers

def fetch_all_prescriptions_pharmacist():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT
            p.prescriptionID, p.prescCode, p.createdAt, p.status, p.rejectionReason,
            pt.name AS patientName, pt.ICnumber,
            d.name AS doctorName,
            ph.name AS pharmacistName
        FROM prescriptions p
        JOIN patients pt ON p.patientID = pt.patientID
        JOIN doctors d ON p.doctorID = d.doctorID
        LEFT JOIN pharmacists ph ON p.verifiedBy = ph.pharmacistID
        ORDER BY p.createdAt DESC
    """
    cursor.execute(query)
    headers = cursor.fetchall()

    # get items for each prescription
    for h in headers:
        item_query = """
            SELECT
                m.name, m.strength, m.form, m.packSize,
                i.quantity, i.direction, i.indication, i.supplyDays
            FROM prescription_items i
            JOIN medicines m ON i.medicineID = m.medicineID
            WHERE i.prescriptionID = %s
        """
        cursor.execute(item_query, (h['prescriptionID'],))
        h['items'] = cursor.fetchall()

    cursor.close()
    connection.close()
    return headers

def fetch_history_prescriptions_pharmacist():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT
            p.prescriptionID, p.prescCode, p.createdAt, p.status, p.rejectionReason,
            pt.name AS patientName, pt.ICnumber,
            d.name AS doctorName,
            ph.name AS pharmacistName
        FROM prescriptions p
        JOIN patients pt ON p.patientID = pt.patientID
        JOIN doctors d ON p.doctorID = d.doctorID
        LEFT JOIN pharmacists ph ON p.verifiedBy = ph.pharmacistID
        WHERE p.status IN ('Verified', 'Active', 'Rejected', 'Completed')
        ORDER BY p.createdAt DESC
    """
    cursor.execute(query)
    headers = cursor.fetchall()

    # get items for each prescription
    for h in headers:
        item_query = """
            SELECT
                m.name, m.strength, m.form, m.packSize,
                i.quantity, i.direction, i.indication, i.supplyDays
            FROM prescription_items i
            JOIN medicines m ON i.medicineID = m.medicineID
            WHERE i.prescriptionID = %s
        """
        cursor.execute(item_query, (h['prescriptionID'],))
        h['items'] = cursor.fetchall()

    cursor.close()
    connection.close()
    return headers

def search_prescription_by_code(search_term):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT
            p.prescriptionID, p.prescCode, p.createdAt, p.status, p.rejectionReason,
            pt.name AS patientName, pt.ICnumber,
            d.name AS doctorName
        FROM prescriptions p
        JOIN patients pt ON p.patientID = pt.patientID
        JOIN doctors d ON p.doctorID = d.doctorID
        WHERE p.prescCode LIKE %s OR pt.name LIKE %s OR pt.ICnumber LIKE %s
        ORDER BY p.createdAt DESC
    """
    search_pattern = f'%{search_term}%'
    cursor.execute(query, (search_pattern, search_pattern, search_pattern))
    headers = cursor.fetchall()

    # get items for each prescription
    for h in headers:
        item_query = """
            SELECT
                m.name, m.strength, m.form, m.packSize,
                i.quantity, i.direction, i.indication, i.supplyDays
            FROM prescription_items i
            JOIN medicines m ON i.medicineID = m.medicineID
            WHERE i.prescriptionID = %s
        """
        cursor.execute(item_query, (h['prescriptionID'],))
        h['items'] = cursor.fetchall()

    cursor.close()
    connection.close()
    return headers

def verify_prescription_db(prescription_id, signed_qr_token, pharmacist_id=None):
    connection = get_db_connection()
    cursor = connection.cursor()

    query = """
    UPDATE prescriptions
    SET status = 'Verified', QRcode = %s, verifiedBy = %s
    WHERE prescriptionID = %s
    """
    cursor.execute(query, (signed_qr_token, pharmacist_id, prescription_id))
    connection.commit()

    success = cursor.rowcount > 0
    cursor.close()
    connection.close()
    return success

def reject_prescription_db(prescription_id, reason, pharmacist_id=None):
    connection = get_db_connection()
    cursor = connection.cursor()

    query = """
    UPDATE prescriptions
    SET status = 'Rejected', rejectionReason = %s, verifiedBy = %s
    WHERE prescriptionID = %s
    """
    cursor.execute(query, (reason, pharmacist_id, prescription_id))
    connection.commit()

    success = cursor.rowcount > 0
    cursor.close()
    connection.close()
    return success

# --- AUDIT LOG FUNCTIONS ---
# Audit log
def log_auth_attempt(patient_id, auth_type, status):
    connection = get_db_connection()
    cursor = connection.cursor()
    query = """
    INSERT INTO auth_logs (patientID, authType, status)
    VALUES (%s, %s, %s)
    """
    try:
        cursor.execute(query, (patient_id, auth_type, status))
        connection.commit()
    except Exception as e:
        print(f"Error logging auth attempt: {e}")
    finally:
        cursor.close()
        connection.close()

# Updated Universal Logger
def log_system_activity(user_role, action_type, status, username=None, patient_id=None, details=None):
    connection = get_db_connection()
    cursor = connection.cursor()
    
    query = """
        INSERT INTO auth_logs 
        (userRole, actionType, status, username, patientID, details) 
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    try:
        cursor.execute(query, (user_role, action_type, status, username, patient_id, details))
        connection.commit()
    except Exception as e:
        print(f"Logging Error: {e}")
    finally:
        cursor.close()
        connection.close()

def fetch_system_logs():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)
    
    query = """
        SELECT 
            l.logID, l.userRole, l.actionType, l.status, l.details, l.timestamp, l.username,
            p.name as patientName, p.patientCode 
        FROM auth_logs l
        LEFT JOIN patients p ON l.patientID = p.patientID
        ORDER BY l.timestamp DESC
        LIMIT 50
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    
    for r in rows:
            if r['timestamp']:
                r['timestamp'] = r['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
                
            # Determine "Who" to show in the UI
            if r['patientName']:
                # Use patientCode (e.g., PH-000001) instead of ID
                code = r['patientCode'] if r['patientCode'] else "Unknown"
                r['display_user'] = f"{r['patientName']} ({code})"
            elif r['username']:
                # For staff/admin
                r['display_user'] = f"{r['username']} ({r['userRole']})"
            else:
                r['display_user'] = f"Unknown ({r['userRole']})"

    cursor.close()
    connection.close()
    return rows

# --- AUTHENTICATION FUNCTIONS ---
def verify_staff_login(username, password):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
    SELECT userID, username, role, passwordHash, needsPasswordReset
    FROM users
    WHERE username = %s
    """
    cursor.execute(query, (username,))
    user = cursor.fetchone()

    cursor.close()
    connection.close()

    if user and check_password_hash(user['passwordHash'], password):
        return user # Success
    return None # Failure

def verify_patient_login(ic_number, password):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
    SELECT patientID, name, ICnumber, passwordHash
    FROM patients
    WHERE ICnumber = %s
    """
    cursor.execute(query, (ic_number,))
    patient = cursor.fetchone()

    cursor.close()
    connection.close()

    if patient and check_password_hash(patient['passwordHash'], password):
        return patient # Success
    return None # Failure

def verify_patient_credentials(ic_number, email):
    """
    Verify patient IC number and email combination for password reset
    Returns patient info if valid, None if invalid
    """
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
    SELECT patientID, name, ICnumber, email
    FROM patients
    WHERE ICnumber = %s AND email = %s
    """
    cursor.execute(query, (ic_number, email))
    patient = cursor.fetchone()

    cursor.close()
    connection.close()

    return patient

def check_patient_email_exists(email):
    """
    Check if a patient email already exists in the database
    Returns True if exists, False otherwise
    """
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = "SELECT patientID FROM patients WHERE email = %s"
    cursor.execute(query, (email,))
    result = cursor.fetchone()

    cursor.close()
    connection.close()

    return result is not None

def update_staff_password(user_id, new_password):
    user_id = int(user_id)
    connection = get_db_connection()
    cursor = connection.cursor()

    new_hash = generate_password_hash(new_password)

    try:
        # First, let's check the current state
        cursor.execute("SELECT needsPasswordReset FROM users WHERE userID = %s", (user_id,))
        result = cursor.fetchone()
        print(f"DEBUG: Before update, needsPasswordReset = {result[0] if result else 'NOT FOUND'}")

        query = """
        UPDATE users
        SET passwordHash = %s, needsPasswordReset = 0
        WHERE userID = %s
        """
        cursor.execute(query, (new_hash, user_id))
        rows_affected = cursor.rowcount
        print(f"DEBUG: Update query affected {rows_affected} rows")

        # Check the state after update
        cursor.execute("SELECT needsPasswordReset FROM users WHERE userID = %s", (user_id,))
        result = cursor.fetchone()
        print(f"DEBUG: After update, needsPasswordReset = {result[0] if result else 'NOT FOUND'}")

        connection.commit()
        return rows_affected > 0
    except Exception as e:
        print(f"Error updating password: {e}")
        connection.rollback()
        return False
    finally:
        cursor.close()
        connection.close()

def update_patient_password(patient_id, new_password):
    connection = get_db_connection()
    cursor = connection.cursor()

    new_hash = generate_password_hash(new_password)

    try:
        query = """
        UPDATE patients
        SET passwordHash = %s
        WHERE patientID = %s
        """
        cursor.execute(query, (new_hash, patient_id))
        connection.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error updating patient password: {e}")
        return False
    finally:
        cursor.close()
        connection.close()

# --- ADMIN FUNCTIONS ---
def add_staff_user(staff_code, role):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        username = staff_code.replace("-", "")
        raw_password = f"A{username}"

        # Check if user already exists
        cursor.execute("SELECT userID FROM users WHERE username = %s", (username,))
        existing_user = cursor.fetchone()

        if existing_user:
            # User already exists, return success
            return {
                "success": True,
                "username": username,
                "default_pass": raw_password
            }

        # User doesn't exist, create it
        password_hash = generate_password_hash(raw_password)

        query = """
        INSERT INTO users (username, passwordHash, role, needsPasswordReset)
        VALUES (%s, %s, %s, TRUE)
        """
        cursor.execute(query, (username, password_hash, role))
        connection.commit()
        return {
            "success": True,
            "username": username,
            "default_pass": raw_password
        }

    except Exception as e:
        print(f"Error adding staff user: {e}")
        return {"success": False, "error": str(e)}
    finally:
        cursor.close()
        connection.close()

def get_staff_code(table, id_column, id_value, code_column):
    connection = get_db_connection()
    cursor = connection.cursor()

    query = f"""
    SELECT {code_column} FROM {table}
    WHERE {id_column} = %s
    """
    cursor.execute(query, (id_value,))
    result = cursor.fetchone()

    cursor.close()
    connection.close()

    if result:
        return result[0]
    return None

def get_pharmacist_id_by_user_id(user_id):
    connection = get_db_connection()
    cursor = connection.cursor()

    # Direct query using the new userID foreign key column
    query = """
    SELECT pharmacistID FROM pharmacists
    WHERE userID = %s
    """
    cursor.execute(query, (user_id,))
    result = cursor.fetchone()

    cursor.close()
    connection.close()

    if result:
        return result[0]
    return None

# --- PASSWORD RESET FUNCTIONS ---
def verify_staff_credentials(staff_code, email):
    """
    Verify staff code and email combination for password reset
    Returns user info if valid, None if invalid
    """
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    # Check doctors table
    doctor_query = """
    SELECT d.doctorID, d.name, d.email, u.userID, 'Doctor' as role
    FROM doctors d
    JOIN users u ON d.userID = u.userID
    WHERE d.doctorCode = %s AND d.email = %s
    """
    cursor.execute(doctor_query, (staff_code, email))
    doctor = cursor.fetchone()

    if doctor:
        cursor.close()
        connection.close()
        return doctor

    # Check pharmacists table
    pharmacist_query = """
    SELECT p.pharmacistID, p.name, p.email, u.userID, 'Pharmacist' as role
    FROM pharmacists p
    JOIN users u ON p.userID = u.userID
    WHERE p.pharmacistCode = %s AND p.email = %s
    """
    cursor.execute(pharmacist_query, (staff_code, email))
    pharmacist = cursor.fetchone()

    cursor.close()
    connection.close()

    return pharmacist

# --- ADMIN EXTRA FUNCTIONS ---

def fetch_all_patients_admin():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)
    
    # We don't need faceID for the table view
    query = """
        SELECT patientID, patientCode, name, ICnumber, email, phoneNumber, createdAt 
        FROM patients 
        ORDER BY createdAt DESC
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    
    # Format Date
    for r in rows:
        if r['createdAt']:
            r['createdAt'] = r['createdAt'].strftime('%Y-%m-%d')
            
    cursor.close()
    connection.close()
    return rows

def fetch_system_logs():
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Join with patients table to show NAMES instead of just IDs
        query = """
            SELECT
                l.logID, l.actionType, l.status, l.details, l.timestamp, l.username, l.userRole, l.patientID,
                p.name as patientName, p.patientCode
            FROM auth_logs l
            LEFT JOIN patients p ON l.patientID = p.patientID
            ORDER BY l.timestamp DESC
            LIMIT 50
        """
        cursor.execute(query)
        rows = cursor.fetchall()

        # Format Time
        for r in rows:
            if r['timestamp']:
                if isinstance(r['timestamp'], date):
                    r['timestamp'] = r['timestamp'].strftime('%Y-%m-%d %H:%M:%S')

            # Determine "Who" to show in the UI
            if r['username']:
                # For staff, username is usually their code (e.g., DR001)
                r['display_user'] = f"{r['username']} ({r['userRole']})"
            elif r['patientName']:
                # Use patientCode (e.g., PH-000001) instead of ID if available
                code_display = r['patientCode'] if r['patientCode'] else "Unknown Code"
                r['display_user'] = f"{r['patientName']} ({code_display})"
            else:
                r['display_user'] = f"Unknown ({r['userRole']})"

        cursor.close()
        connection.close()
        return rows
    except Exception as e:
        print(f"Error fetching system logs: {e}")
        return []
