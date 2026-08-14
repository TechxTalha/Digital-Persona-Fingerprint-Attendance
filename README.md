# Biometric Attendance System

A modern, high-performance biometric attendance application designed to work natively with **DigitalPersona / HID U.are.U** fingerprint scanners on the web.

This system leverages a distributed microservice architecture to securely capture fingerprint data via the browser and match it against a database of enrolled employees using a Java implementation of the SourceAFIS fingerprint matching algorithm.

---

## 🏗 Architecture Overview

The system is broken down into three core services:

### 1. Frontend — React + Vite + TailwindCSS

- Provides the **Kiosk Mode** for fingerprint scanning and the **Admin Dashboard**.
- Integrates with the `@digitalpersona/devices` Web SDK to communicate with the DigitalPersona fingerprint reader.
- Captures standard PNG fingerprint images from the scanner.
- Sends captured fingerprint data securely to the Node.js backend.

### 2. Backend — Node.js + Express + MongoDB

- Manages employees, payroll, shifts, and attendance logs.
- Acts as the central orchestrator between the Frontend and Java Matcher Service.
- Handles biometric enrollment, verification, and identification requests.
- Stores serialized biometric templates rather than raw fingerprint images.

### 3. Matcher Service — Java Spring Boot + SourceAFIS

- A dedicated biometric matching microservice.
- Receives fingerprint PNG images from the Node.js backend.
- Generates SourceAFIS fingerprint templates.
- Performs **1:1 verification** and **1:N identification**.
- Keeps biometric processing independent from the main Node.js application.
- Does not require Windows Biometric Framework (WinBio).

---

## 🏗 System Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                    Windows 11 Client                    │
│                                                         │
│  ┌─────────────────┐                                    │
│  │ U.are.U 4500    │                                    │
│  │ Fingerprint     │                                    │
│  │ Scanner         │                                    │
│  └────────┬────────┘                                    │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────────────────┐                        │
│  │ HID Non-WBF Driver          │                        │
│  └────────┬────────────────────┘                        │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────────────────┐                        │
│  │ HID Authentication Device   │                        │
│  │ Client                      │                        │
│  │ (formerly Lite Client)      │                        │
│  └────────┬────────────────────┘                        │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────────────────┐                        │
│  │ DigitalPersona Web SDK      │                        │
│  └────────┬────────────────────┘                        │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────────────────┐                        │
│  │ React + Vite Frontend       │                        │
│  └─────────────┬───────────────┘                        │
└────────────────┼────────────────────────────────────────┘
                 │ HTTPS
                 ▼
        ┌─────────────────────┐
        │ Node.js + Express   │
        │ Backend             │
        └──────────┬──────────┘
                   │
                   │ Internal HTTP
                   ▼
        ┌─────────────────────┐
        │ Java Spring Boot    │
        │ Matcher Service     │
        │                     │
        │ SourceAFIS          │
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │ MongoDB             │
        │                     │
        │ Employee Data       │
        │ Attendance Logs     │
        │ Biometric Templates │
        └─────────────────────┘
```

---

# 🔌 Hardware & Driver Requirements

To use the DigitalPersona Web SDK, the client machine — the computer where the USB fingerprint scanner is physically connected — must have the appropriate HID/DigitalPersona software installed.

The application is designed to work with the **DigitalPersona U.are.U 4500** fingerprint reader.

---

## 1. HID DigitalPersona 4500 Non-WBF Driver

This project intentionally uses the **Non-WBF / Legacy driver** rather than the Windows Biometric Framework (WBF) driver.

The Non-WBF driver is important because this application does **not** use:

- Windows Hello
- Windows Biometric Framework (WinBio)
- Windows biometric enrollment

### Official Download

https://www.hidglobal.com/drivers/49061

The official HID driver page identifies the DigitalPersona 4500 Non-WBF Driver as version **4.1.1.221** and lists Windows 11 / Windows 11 x64 support.

> **Important:** Do not install the HID DigitalPersona 4500 WBF/Hello driver for this project.

---

## 2. HID Authentication Device Client

The browser cannot directly communicate with the USB fingerprint reader.

The DigitalPersona Web SDK uses a local Windows component to provide communication between the browser and the fingerprint device.

The product is currently called:

**HID Authentication Device Client**

It was previously known as:

**DigitalPersona Lite Client**

### Official Download

https://digitalpersona.hidglobal.com/lite-client/

Install the Windows 64-bit version on the machine where the U.are.U 4500 is connected.

---

# 🌐 Web SDK

The frontend uses the official DigitalPersona Web SDK.

The browser communicates with the local HID/DigitalPersona client rather than directly accessing the USB device.

```text
React
   ↓
@digitalpersona/devices
   ↓
DigitalPersona Web SDK
   ↓
HID Authentication Device Client
   ↓
U.are.U 4500
```

This allows the application to capture fingerprint samples from the U.are.U 4500 directly from the browser.

---

# 🧬 Fingerprint Processing

The Web SDK is configured to capture the fingerprint as a standard **PNG image** rather than using the proprietary DigitalPersona Pre-Registration FeatureSet format.

The current capture pipeline is:

```text
U.are.U 4500
      ↓
DigitalPersona Web SDK
      ↓
PNG Fingerprint Image
      ↓
Base64
      ↓
Node.js Backend
      ↓
Java SourceAFIS Matcher
```

The captured U.are.U 4500 fingerprint images are approximately:

```text
Resolution: 500 × 550 pixels
Format: PNG
Color: sRGB / 8-bit
```

The PNG's embedded DPI metadata should not be assumed to represent the physical acquisition resolution of the fingerprint sensor.

The matcher is configured using the appropriate sensor acquisition resolution.

---

# 🧬 Biometric Matching

The application uses **SourceAFIS** for fingerprint template generation and matching.

SourceAFIS runs inside the dedicated Java Matcher Service rather than directly inside Node.js.

This keeps the main application independent of the biometric matching implementation.

### Matching operations

### 1:1 Verification

Used when the employee is already known.

```text
Claimed Employee
       ↓
Fingerprint Capture
       ↓
SourceAFIS
       ↓
Compare Against Employee Template
       ↓
Verified / Rejected
```

### 1:N Identification

Used by Kiosk Mode.

```text
Fingerprint Capture
       ↓
SourceAFIS Template
       ↓
Compare Against Registered Templates
       ↓
Best Candidate
       ↓
Matching Threshold
       ↓
Employee Identified
```

---

# 🚀 Getting Started

## Prerequisites

Install the following:

- Node.js 18+
- Java JDK 17+
- MongoDB
- Windows 11
- DigitalPersona / HID U.are.U 4500 fingerprint scanner
- HID DigitalPersona 4500 Non-WBF driver
- HID Authentication Device Client

---

# 1. Install the Fingerprint Driver

Download and install the official:

**HID DigitalPersona 4500 Non-WBF Driver**

Official download:

https://www.hidglobal.com/drivers/49061

After installation, connect the U.are.U 4500 and verify that Windows detects the device.

Do **not** install the WBF/Windows Hello driver.

---

# 2. Install the HID Authentication Device Client

Download the official:

**HID Authentication Device Client**

Official download:

https://digitalpersona.hidglobal.com/lite-client/

This software was previously known as the **DigitalPersona Lite Client**.

Install the Windows 64-bit version on the machine where the U.are.U 4500 is connected.

---

# 3. Start the Java Matcher Service

The biometric engine must be running before fingerprint matching can occur.

```bash
cd matcher-service
./mvnw spring-boot:run
```

The matcher service runs on:

```text
http://localhost:8080
```

---

# 4. Start the Node.js Backend

```bash
cd backend
npm install
npm run dev
```

The Node.js backend runs on:

```text
http://localhost:5000
```

---

# 5. Start the React Frontend

```bash
cd frontend
npm install
npm run dev
```

The React frontend runs on:

```text
http://localhost:5173
```

---

# 🛠 Usage & Features

## Initial Setup

When the application starts for the first time:

1. Open the Admin Dashboard.
2. Click **Seed Database**.
3. Sample employees will be generated.
4. Employees can then be enrolled with fingerprints.

---

## Fingerprint Enrollment

From the Employee Directory:

1. Select an employee.
2. Click **Enroll Fingerprint**.
3. Place the employee's finger on the U.are.U 4500.
4. Capture the same finger multiple times.
5. The system generates a SourceAFIS biometric template.
6. The serialized template is stored against the employee.

Multiple fingerprints can be registered for the same employee.

For example:

```text
Employee #123
├── Right Thumb
├── Left Thumb
├── Right Index
└── Left Index
```

This provides additional flexibility if a particular finger cannot be read reliably.

---

# 🖥 Kiosk Mode

Kiosk Mode is designed for day-to-day attendance scanning.

An employee simply places an enrolled finger on the U.are.U 4500.

The system:

```text
Scan Finger
     ↓
Capture PNG
     ↓
Generate SourceAFIS Template
     ↓
1:N Identification
     ↓
Identify Employee
     ↓
Determine Attendance State
     ↓
Clock In / Clock Out
```

The system can determine whether the employee should be clocked in or out based on their attendance state and shift schedule.

---

# 📊 Attendance Management

Administrators can view and manage attendance records.

Attendance records can be filtered by:

- Employee
- Date
- Shift
- Attendance status

---

# 💰 Payroll & Shift Management

The backend supports employee management and shift-related attendance processing.

Employee information, shifts, payroll-related information, and attendance records are managed through the Node.js backend and MongoDB.

---

# 📤 Exporting Attendance Logs

Administrators can export attendance records in:

- Excel (`.xlsx`)
- Landscape PDF

Exports can be filtered before generation.

---

# 🔐 Security Considerations

Fingerprint data is highly sensitive biometric information.

The application should follow these principles:

- Do not store raw fingerprint images permanently unless absolutely required.
- Convert captured fingerprint images into biometric templates.
- Store serialized biometric templates instead of raw images.
- Do not log Base64 fingerprint payloads.
- Use HTTPS for communication between the frontend and backend.
- Restrict access to biometric enrollment and administration functions.
- Protect the Java Matcher Service from public Internet access.
- Keep the matcher service accessible only to the Node.js backend.
- Use authentication and authorization for administrative biometric operations.
- Do not use Windows Biometric Framework for application-level enrollment.

---

# ⚠️ Important Driver Note

This project intentionally does **not** use:

```text
Windows Biometric Framework
WinBio
Windows Hello
```

The Windows biometric enrollment system is separate from the application's biometric database.

Fingerprint registrations are managed by the application itself through SourceAFIS.

Therefore, application enrollment is independent of Windows biometric enrollment.

---

# 🧩 Service Ports

| Service | Port | Purpose |
|---|---:|---|
| React / Vite | `5173` | Frontend |
| Node.js / Express | `5000` | Main backend |
| Java / Spring Boot | `8080` | Fingerprint matcher |
| MongoDB | `27017` | Database |

---

# 🔄 Complete Data Flow

## Enrollment

```text
Employee
   ↓
React
   ↓
DigitalPersona Web SDK
   ↓
U.are.U 4500
   ↓
PNG Fingerprint
   ↓
Node.js
   ↓
Java Matcher
   ↓
SourceAFIS Template
   ↓
Node.js
   ↓
MongoDB
```

## Kiosk Identification

```text
Employee
   ↓
U.are.U 4500
   ↓
DigitalPersona Web SDK
   ↓
PNG Fingerprint
   ↓
Node.js
   ↓
Java Matcher
   ↓
SourceAFIS 1:N Matching
   ↓
Employee ID
   ↓
Node.js
   ↓
Attendance Record
   ↓
MongoDB
```

---

# 📁 Project Structure

```text
biometric-attendance/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── src/
│   ├── models/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   └── package.json
│
├── matcher-service/
│   ├── src/
│   ├── pom.xml
│   └── mvnw
│
└── README.md
```

---

# 🔗 Official HID Resources

### HID Authentication Device Client

Formerly known as DigitalPersona Lite Client.

https://digitalpersona.hidglobal.com/lite-client/

### HID DigitalPersona 4500 Non-WBF Driver

Official Windows 11-compatible legacy/non-WBF driver.

https://www.hidglobal.com/drivers/49061

### HID DigitalPersona Drivers & Downloads

https://www.hidglobal.com/drivers

### DigitalPersona Web SDK Documentation

https://hidglobal.github.io/digitalpersona-devices/

---

# 📝 Current Implementation Status

| Component | Status |
|---|---|
| U.are.U 4500 hardware | ✅ Working |
| Windows 11 | ✅ Supported |
| Non-WBF driver | ✅ Installed |
| HID Authentication Device Client | ✅ Installed |
| DigitalPersona Web SDK | ✅ Working |
| Browser fingerprint capture | ✅ Working |
| PNG fingerprint capture | ✅ Working |
| Node.js integration | ✅ Working |
| Java SourceAFIS service | ✅ Working |
| Fingerprint template generation | ✅ Working |
| Same-finger matching | ✅ Working |
| Different-finger rejection | ✅ Working |
| 1:N identification | ✅ Working |
| Production threshold calibration | ✅ Working |
| Full attendance workflow | ✅ Working |
