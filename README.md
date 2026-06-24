# UDP Emulator for LabVIEW HIL UI Testing

A high-precision, bi-directional Python UDP emulator designed to simulate real-time HIL (Hardware-In-the-Loop) signals for a Buck Converter LabVIEW UI.

## Features
* **High-Frequency Transmission**: Uses high-precision `time.perf_counter` busy-waiting to target a transmission frequency of **10,000 Hz (0.1 ms interval)**.
* **Bi-directional Communication**:
  * **Sender**: Publishes 6 simulated converter variables as double-precision values to LabVIEW.
  * **Receiver**: Runs a background listener thread to receive command packets from LabVIEW without blocking the sender.
* **Byte Order / Endianness**: Configured for **Big-Endian** (`>`) format to match LabVIEW's default network serialization.

---

## Configuration & Ports

| Direction | Port | Data Type | Bytes | Description |
|---|---|---|---|---|
| **Send** (To LabVIEW) | `54400` | 6 × 64-bit Doubles (`>dddddd`) | 48 bytes | Outputs simulated Buck Converter state variables (`Vout`, `iL`, `Ref`, `Duty`, `Noise`, `Timestamp`) |
| **Receive** (From LabVIEW) | `25000` | 6 × 64-bit Doubles (`>dddddd`) | 48 bytes | Listens for commands or overrides from the LabVIEW UI |

---

## Getting Started

### 1. Prerequisites
Ensure you have the Python 3 launcher (`py` on Windows) installed.

### 2. Run the Emulator
Open PowerShell in this directory and execute:
```powershell
py udp_emulator.py
```

---

## LabVIEW UI Setup Guide

1. **Receiving Data (UDP Read)**:
   * Open a UDP socket on port **`54400`**.
   * Use **UDP Read** with the `max size` input terminal either unwired or set to at least **`48`** bytes.
   * Wire the string output of the UDP Read to the **Unflatten from String** block.
   * Configure the `type` terminal of the Unflatten block with an **Array of 6 DBLs (Double-Precision Floats)**.
   * Right-click the Unflatten block and ensure **Byte Order** is set to network/Big-Endian.

2. **Sending Commands (UDP Write)**:
   * Configure a **UDP Write** block targeting `127.0.0.1` on port **`25000`**.
   * Flatten your control variables cluster or array (6 × DBL) to a string and send it to the emulator.
