import socket
import time
import math
import random
import struct
import threading

# Configuration
SEND_HOST = "127.0.0.1"
SEND_PORT = 54400
LISTEN_HOST = "0.0.0.0"  # Listen on all local interfaces
LISTEN_PORT = 25000
INTERVAL_SEC = 0.0001    # 0.1 ms (10 kHz frequency)

# Endianness: '<' is Little-Endian, '>' is Big-Endian
BYTE_ORDER = '<'

# Initialize sockets
send_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
recv_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
recv_sock.bind((LISTEN_HOST, LISTEN_PORT))

# Background listener for incoming LabVIEW packets (6 x 64-bit doubles = 48 bytes)
def listen_loop():
    print(f"Background listener started on port {LISTEN_PORT}...")
    expected_size = 48  # 6 doubles * 8 bytes
    while True:
        try:
            data, addr = recv_sock.recvfrom(1024)
            if len(data) == expected_size:
                # Unpack 6 doubles
                vals = struct.unpack(f'{BYTE_ORDER}dddddd', data)
                print(f"\n[Received from {addr[0]}:{addr[1]}] Command Doubles: "
                      f"[{vals[0]:.4f}, {vals[1]:.4f}, {vals[2]:.4f}, {vals[3]:.4f}, {vals[4]:.4f}, {vals[5]:.4f}]")
            else:
                print(f"\n[Warning] Received unexpected packet size: {len(data)} bytes (expected {expected_size} bytes)")
        except Exception as e:
            # Socket closed or other issue
            break

# Start background thread
listener_thread = threading.Thread(target=listen_loop, daemon=True)
listener_thread.start()

print(f"Starting UDP Emulator...")
print(f"Sending to: {SEND_HOST}:{SEND_PORT}")
print(f"Listening on: {LISTEN_HOST}:{LISTEN_PORT}")
print(f"Send Interval: {INTERVAL_SEC * 1000:.2f} ms (~{int(1/INTERVAL_SEC)} Hz)")
print(f"Payload Format: 6 x 64-bit doubles (48 bytes total, Big Endian)")
print("Press Ctrl+C to stop.")

# State variables for signal simulation
t = 0.0
count = 0
start_time = time.perf_counter()
next_time = start_time

try:
    while True:
        # 1. Generate 6 variables simulating typical HIL/converter signals
        val1 = 12.0 + 2.0 * math.sin(2 * math.pi * 50 * t)  # Vout (sine wave around 12V)
        val2 = 2.5 + 0.5 * math.sin(2 * math.pi * 50 * t - math.pi/4) + random.uniform(-0.05, 0.05)  # Current
        val3 = 12.0  # Reference
        val4 = 0.5 + 0.1 * math.sin(2 * math.pi * 10 * t)  # Duty
        val5 = random.uniform(-0.1, 0.1)  # Noise
        val6 = t  # Timestamp
        
        # 2. Pack as 6 double-precision floats (8 bytes each = 48 bytes total)
        payload = struct.pack(f'{BYTE_ORDER}dddddd', val1, val2, val3, val4, val5, val6)
        
        # 3. Send via UDP
        send_sock.sendto(payload, (SEND_HOST, SEND_PORT))
        
        # 4. Increment simulation time
        t += INTERVAL_SEC
        count += 1
        
        # Print status every 10,000 packets (~1 second)
        if count % 10000 == 0:
            elapsed = time.perf_counter() - start_time
            actual_rate = count / elapsed
            print(f"Sent {count} packets. Current rate: {actual_rate:.1f} Hz (Target: {int(1/INTERVAL_SEC)} Hz)")
            print(f"Last values sent: [{val1:.3f}, {val2:.3f}, {val3:.3f}, {val4:.3f}, {val5:.3f}, {val6:.3f}]")

        # 5. High-precision timing loop using busy-wait
        next_time += INTERVAL_SEC
        while time.perf_counter() < next_time:
            pass

except KeyboardInterrupt:
    print("\nStopping UDP emulator...")
finally:
    send_sock.close()
    recv_sock.close()
    print("Sockets closed. Done.")
