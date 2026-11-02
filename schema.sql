-- Create machines table 
CREATE TABLE IF NOT EXISTS machines (
   id SERIAL PRIMARY KEY,
   name VARCHAR(100) NOT NULL,
   location VARCHAR(100) NOT NULL,
   status VARCHAR(20) DEFAULT 'operational',
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
);

-- Create machine_telemetry table
CREATE TABLE IF NOT EXISTS machine_telemetry (
    id SERIAL PRIMARY KEY,
    machine_id INT REFERENCES machines(id) ON DELETE CASCADE,
    vibration FLOAT NOT NULL,
    temperature FLOAT NOT NULL,
    pressure FLOAT NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create maintenance_tickets table
CREATE TABLE IF NOT EXISTS maintenance_tickets (
    id SERIAL PRIMARY KEY,
    machine_id INT REFERENCES machines(id) ON DELETE CASCADE,
    issue_description TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample machine records for testing
INSERT INTO machines (name, location) VALUES
('Compressor Unit A1', 'Factory Floor 1'),
('Hydraulic Press B2', 'Assembly Line 3')
ON CONFLICT DO NOTHING