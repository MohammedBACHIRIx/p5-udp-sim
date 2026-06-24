# UDP Emulator & Web Console for LabVIEW HIL UI Testing

A high-performance, unified Node.js real-time simulation dashboard designed to simulate and control HIL (Hardware-In-the-Loop) signals for a Buck Converter LabVIEW UI.

## Features
* **No Python Prerequisite**: The HIL simulation math and UDP socket loop run directly within the Node.js backend.
* **Unified Web Console**:
  * **Interactive Parameters**: Tweak sliders (e.g., target voltage reference, duty cycle, noise, simulated load) and toggle execution state (Run/Pause) in real-time.
  * **Transmit Telemetry**: Sends 6 simulated variables to LabVIEW on port `54400` as double-precision values.
  * **Receive Telemetry**: Listens to LabVIEW on port `25000` and displays the incoming command values in real-time in the browser.
* **Byte Order / Endianness**: Serialized as **Big-Endian** (`>`) format to match LabVIEW's default network configuration.

---

## Configuration & Ports

| Direction | Port | Data Type | Bytes | Description |
|---|---|---|---|---|
| **Send** (To LabVIEW) | `54400` | 6 × 64-bit Doubles (Big Endian) | 48 bytes | Outputs simulated Buck Converter state variables (`Vout`, `iL`, `Ref`, `Duty`, `Noise`, `Timestamp`) |
| **Receive** (From LabVIEW) | `25000` | 6 × 64-bit Doubles (Big Endian) | 48 bytes | Listens for commands or feedback from the LabVIEW UI |

---

## Getting Started

### 1. Prerequisites
Ensure you have **Node.js** installed on your system.

### 2. Start the Server
Open PowerShell in this directory and execute:
```powershell
npm start
```

### 3. Open the Dashboard
Navigate to **[http://localhost:3000](http://localhost:3000)** in your web browser.

---

## LabVIEW UI Setup Guide

1. **Receiving Data (UDP Read)**:
   * Open a UDP socket on port **`54400`**.
   * Use **UDP Read** with the `max size` input terminal set to at least **`48`** bytes.
   * Wire the string output of the UDP Read to the **Unflatten from String** block.
   * Configure the `type` terminal of the Unflatten block with an **Array of 6 DBLs (Double-Precision Floats)**.
   * Ensure **Byte Order** is set to network/Big-Endian.

2. **Sending Commands (UDP Write)**:
   * Configure a **UDP Write** block targeting `127.0.0.1` on port **`25000`**.
   * Flatten your control variables array/cluster (6 × DBL) to a string and send it to the server.
