import os
import time
import random
import requests

# Use your live Render API URL
API_URL = os.getenv("API_URL", "https://plantpulse-api-ccov.onrender.com/api/telemetry")

def simulate_telemetry():
    # Simulate data for machine ID 1 (Compressor Unit A1) and ID 2 (Hydraulic Press B2)
    machine_id = random.choice([1, 2])
    
    # Random sensor values (occasionally triggering high values to test alerts)
    vibration = round(random.uniform(2.0, 9.5), 2)
    temperature = round(random.uniform(60.0, 95.0), 2)
    pressure = round(random.uniform(30.0, 65.0), 2)
    
    payload = {
        "machine_id": machine_id,
        "vibration": vibration,
        "temperature": temperature,
        "pressure": pressure
    }
    
    try:
        response = requests.post(API_URL, json=payload)
        if response.status_code == 201:
            print(f"[SUCCESS] Telemetry recorded for Machine {machine_id}: Vib={vibration}, Temp={temperature}°C, Press={pressure}PSI")
        else:
            print(f"[WARNING] Failed to record telemetry: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"[ERROR] Connection error: {e}")

if __name__ == "__main__":
    print("Starting PlantPulse AI Telemetry Simulation Worker...")
    while True:
        simulate_telemetry()
        # Send new telemetry data every 10 seconds
        time.sleep(10)
