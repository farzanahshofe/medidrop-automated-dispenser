// Smart Drawer Dispenser Code for ESP32
// Logic: Open via HTTP /open, Auto-close 3 seconds AFTER weight is removed.

#include <Arduino.h>
#include <ESP32Servo.h>
#include <WiFi.h>
#include <WebServer.h>
#include "HX711.h"

// --- 1. CONFIGURATION ---
const char* ssid     = "Infarz"; //2.4Ghz only
const char* password = "4567845678";

// Pins
const int SERVO_PIN = 13;
const int LOADCELL_DOUT_PIN = 19; //white
const int LOADCELL_SCK_PIN = 18; //gray
const int STATUS_LED = 2; 

// Servo Angles
const int ANGLE_CLOSED = 10;
const int ANGLE_OPEN = 110;

// Load Cell Settings
const float CALIBRATION_FACTOR = 1200.098; 
const float WEIGHT_THRESHOLD = 5.0; // Grams

// --- 2. OBJECTS ---
Servo myServo;
HX711 scale;
WebServer server(80);

bool isDrawerOpen = false;
unsigned long weightRemovedTime = 0; // Tracks when the weight first dropped below threshold

// --- 3. HELPER FUNCTIONS ---

void moveServo(int startAngle, int endAngle) {
  if (startAngle > endAngle) {
    for (int pos = startAngle; pos >= endAngle; pos--) {
      myServo.write(pos);
      delay(15); 
    }
  } else {
    for (int pos = startAngle; pos <= endAngle; pos++) {
      myServo.write(pos);
      delay(15);
    }
  }
}

// --- 4. API HANDLERS ---

void handleRoot() {
  server.send(200, "text/plain", "Smart Drawer Dispenser Online");
}

void handleOpen() {
  Serial.println("\n[HTTP] CMD: OPEN DRAWER");
  if (!isDrawerOpen) {
    moveServo(ANGLE_CLOSED, ANGLE_OPEN);
    isDrawerOpen = true;
    weightRemovedTime = 0; // Reset the timer
    server.send(200, "application/json", "{\"status\":\"success\", \"message\":\"Drawer Opened.\"}");
  } else {
    server.send(200, "application/json", "{\"status\":\"ignored\", \"message\":\"Already Open\"}");
  }
}

void handleClose() {
  Serial.println("\n[HTTP] CMD: CLOSE DRAWER");
  if (isDrawerOpen) {
    moveServo(ANGLE_OPEN, ANGLE_CLOSED);
    isDrawerOpen = false;
    server.send(200, "application/json", "{\"status\":\"success\", \"message\":\"Drawer Closed\"}");
  } else {
    server.send(200, "application/json", "{\"status\":\"ignored\", \"message\":\"Already Closed\"}");
  }
}

void handleStatus() {
  float weight = scale.get_units(5);
  String json = "{";
  json += "\"drawer\": \"" + String(isDrawerOpen ? "OPEN" : "CLOSED") + "\",";
  json += "\"weight\": " + String(weight) + ",";
  json += "\"is_empty\": " + String(weight < WEIGHT_THRESHOLD ? "true" : "false"); 
  json += "}";
  server.send(200, "application/json", json);
}

// --- 5. SETUP & LOOP ---

void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED, OUTPUT);
  
  myServo.attach(SERVO_PIN, 500, 2400);
  myServo.write(ANGLE_CLOSED); 
  
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale(CALIBRATION_FACTOR);
  
  Serial.println("Initializing Load Cell...");
  Serial.println("IMPORTANT: Ensure scale is EMPTY now.");
  
  if (scale.wait_ready_timeout(2000)) {
    scale.tare(); // Resets the scale to 0.0g
    Serial.println("HX711 Ready. Scale Tared.");
  } else {
    Serial.println("HX711 not found!");
  }

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    digitalWrite(STATUS_LED, !digitalRead(STATUS_LED)); 
  }
  digitalWrite(STATUS_LED, HIGH);
  
  Serial.println("WiFi Connected. IP: " + WiFi.localIP().toString());

  server.on("/", handleRoot);
  server.on("/open", HTTP_GET, handleOpen);
  server.on("/close", HTTP_GET, handleClose);
  server.on("/status", HTTP_GET, handleStatus);
  server.begin();
}

void loop() {
  server.handleClient();
  
  if (isDrawerOpen) {
    float currentWeight = scale.get_units(1); 
    
    // Debug output
    static unsigned long lastPrint = 0;
    if (millis() - lastPrint > 1000) {
      Serial.print("Weight: "); Serial.print(currentWeight); Serial.println("g");
      lastPrint = millis();
    }

    // Wait 3 seconds AFTER removal
    if (currentWeight < WEIGHT_THRESHOLD) {
      // If weight is gone, start or check the timer
      if (weightRemovedTime == 0) {
        weightRemovedTime = millis(); // Start the 3s countdown
        Serial.println("Weight removed detected. Starting 3s countdown...");
      }
      
      if (millis() - weightRemovedTime > 3000) {
        Serial.println("3 seconds elapsed. Closing drawer.");
        moveServo(ANGLE_OPEN, ANGLE_CLOSED);
        isDrawerOpen = false;
        weightRemovedTime = 0;
      }
    } else {
      // If weight is put back, reset the timer
      if (weightRemovedTime != 0) {
        Serial.println("Weight detected again. Resetting timer.");
        weightRemovedTime = 0;
      }
    }
  }
  delay(50); 
}