# NPP Delegate Voting & Authentication API Integration Guide

This document provides complete technical specifications for integrating third-party voting applications, mobile clients, kiosk interfaces, or USSD services with the **New Patriotic Party (NPP) National Elections Delegate Voting System**.

---

## 1. System Architecture & Flow

The voting authentication follows a secure 3-step verification model:

```
┌─────────────────────────┐       ┌─────────────────────────┐       ┌─────────────────────────┐
│   Step 1: Sign In       │       │   Step 2: Verify OTP    │       │   Step 3: Confirmation  │
│  POST /api/voting/login ├──────►│   POST /api/voting/otp  ├──────►│ GET /api/voting/        │
│  (Voter ID / Phone)     │       │   (6-Digit Code)        │       │     confirmation        │
└─────────────────────────┘       └─────────────────────────┘       └─────────────────────────┘
```

1. **Step 1: Identification & OTP Dispatch (`POST /api/voting/login`)**  
   The delegate provides either their **10-digit Electoral Commission Voter ID** or registered **Ghana mobile phone number**. The system validates the record against `executives_all` and dispatches an OTP via SMS.
2. **Step 2: OTP Verification & Session Issuance (`POST /api/voting/otp`)**  
   The delegate enters the 6-digit code. The server verifies it against expiry (10 minutes), retry limits (max 5 attempts), and single-use constraints. Upon success, an HMAC SHA-256 session token is generated, set via `HttpOnly` cookie, and returned in the JSON response alongside entitled voting portfolios.
3. **Step 3: Election Confirmation (`GET /api/voting/confirmation`)**  
   The client presents the session token (via cookie or `Authorization: Bearer <token>`) to load the certified delegate profile and the complete list of contested national portfolios the delegate is constitutionally authorized to vote for.

---

## 2. Base URLs & Common Headers

- **Local Development**: `http://localhost:3000`
- **Production Server**: `https://<your-domain>.com`

All `POST` requests require:
```http
Content-Type: application/json
Accept: application/json
```

---

## 3. API Endpoints

### 3.1. Step 1: Request OTP / Login

Dispatches a 6-digit verification code to the phone registered on the delegate's executive record.

- **URL**: `/api/voting/login`
- **Method**: `POST`
- **Authentication**: Public

#### Request Body
| Field | Type | Required | Description | Example |
| :--- | :---: | :---: | :--- | :--- |
| `identifier` | string | **Yes** | 10-digit EC Voter ID or registered mobile phone number. | `"1928472910"` or `"0241234567"` |

> **Phone Number Formats Supported**:  
> Ghana phone numbers are normalized automatically: `0241234567`, `+233241234567`, `233241234567`, or formatted with spaces (`024 123 4567`).

#### Success Response (`HTTP 200 OK`)
```json
{
  "success": true,
  "message": "Verification code sent successfully to your registered phone number.",
  "identifier": "1928472910",
  "phoneMasked": "024****567",
  "expiresInSeconds": 600,
  "devOtp": "842193"
}
```
*(Note: `devOtp` is only included in non-production environments to assist development and testing).*

#### Error Responses
- **`HTTP 400 Bad Request`**: Missing identifier or no phone number on record.
  ```json
  {
    "success": false,
    "error": "Please enter your 10-digit Voter ID or registered Phone number."
  }
  ```
- **`HTTP 404 Not Found`**: Delegate not found or non-voting role (e.g., TESCON Patron).
  ```json
  {
    "success": false,
    "error": "Verification failed. No eligible voter was found matching the provided details."
  }
  ```

#### Example cURL
```bash
curl -X POST https://your-domain.com/api/voting/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "1928472910"}'
```

---

### 3.2. Step 2: Verify OTP

Verifies the 6-digit verification code, marks the code as used, resolves the delegate's voting entitlements, and issues an authorized session token.

- **URL**: `/api/voting/otp`
- **Method**: `POST`
- **Authentication**: Public

#### Request Body
| Field | Type | Required | Description | Example |
| :--- | :---: | :---: | :--- | :--- |
| `identifier` | string | **Yes** | Same Voter ID or Phone number used in Step 1. | `"1928472910"` |
| `otp` | string | **Yes** | 6-digit numeric verification code received via SMS. | `"842193"` |

#### Success Response (`HTTP 200 OK`)
*The response also sets a browser cookie: `Set-Cookie: delegate_voting_session=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=14400`*.

```json
{
  "success": true,
  "message": "Identity verified successfully.",
  "delegate": {
    "id": 1042,
    "name": "KOFI MENSAH",
    "voterId": "1928472910",
    "phone": "0241234567",
    "level": "Constituency",
    "region": "Ashanti",
    "constituency": "Bantama",
    "pollingStation": "",
    "position": "Youth Organiser",
    "gender": "Male",
    "age": 34
  },
  "entitledPositions": [
    {
      "id": "chairperson",
      "title": "National Chairperson",
      "category": "general",
      "reason": "Constituency executive officer"
    },
    {
      "id": "1st_vice_chairperson",
      "title": "1st Vice Chairperson",
      "category": "general",
      "reason": "Constituency executive officer"
    },
    {
      "id": "2nd_vice_chairperson",
      "title": "2nd Vice Chairperson",
      "category": "general",
      "reason": "Constituency executive officer"
    },
    {
      "id": "general_secretary",
      "title": "General Secretary",
      "category": "general",
      "reason": "Constituency executive officer"
    },
    {
      "id": "treasurer",
      "title": "National Treasurer",
      "category": "general",
      "reason": "Constituency executive officer"
    },
    {
      "id": "organiser",
      "title": "National Organiser",
      "category": "general",
      "reason": "Constituency executive officer"
    },
    {
      "id": "communication",
      "title": "National Communication Officer",
      "category": "general",
      "reason": "Constituency executive officer"
    },
    {
      "id": "youth_organiser",
      "title": "National Youth Organiser",
      "category": "youth",
      "reason": "Ex-officio Youth Organiser portfolio"
    }
  ],
  "token": "eyJhbGciOiJIUzI1NiJ9...signature"
}
```

#### Error Responses
- **`HTTP 400 Bad Request`**: Incorrect code.
  ```json
  {
    "success": false,
    "error": "Incorrect code. 4 attempts remaining."
  }
  ```
- **`HTTP 400 Bad Request`**: Expired code.
  ```json
  {
    "success": false,
    "error": "The verification code has expired. Please request a new one."
  }
  ```
- **`HTTP 400 Bad Request`**: Brute-force lockout (after 5 failed attempts).
  ```json
  {
    "success": false,
    "error": "Too many incorrect attempts. Please request a new OTP."
  }
  ```

#### Example cURL
```bash
curl -X POST https://your-domain.com/api/voting/otp \
  -H "Content-Type: application/json" \
  -d '{"identifier": "1928472910", "otp": "842193"}'
```

---

### 3.3. Step 3: Election Confirmation & Entitled Positions

Retrieves the authenticated delegate's profile and constitutional voting authorizations.

- **URL**: `/api/voting/confirmation`
- **Method**: `GET` (also accepts `POST` with `{"token": "..."}`)
- **Authentication**: Requires session token via Bearer header or cookie.

#### Request Headers
```http
Authorization: Bearer <token-received-from-step-2>
```
*(Or send with cookies if integrating inside a browser)*.

#### Success Response (`HTTP 200 OK`)
```json
{
  "success": true,
  "delegate": {
    "id": 1042,
    "name": "KOFI MENSAH",
    "voterId": "1928472910",
    "phone": "0241234567",
    "level": "Constituency",
    "region": "Ashanti",
    "constituency": "Bantama",
    "position": "Youth Organiser",
    "gender": "Male",
    "age": 34
  },
  "entitledPositions": [
    {
      "id": "chairperson",
      "title": "National Chairperson",
      "category": "general",
      "reason": "Constituency executive officer"
    },
    {
      "id": "1st_vice_chairperson",
      "title": "1st Vice Chairperson",
      "category": "general",
      "reason": "Constituency executive officer"
    },
    {
      "id": "2nd_vice_chairperson",
      "title": "2nd Vice Chairperson",
      "category": "general",
      "reason": "Constituency executive officer"
    },
    {
      "id": "general_secretary",
      "title": "General Secretary",
      "category": "general",
      "reason": "Constituency executive officer"
    },
    {
      "id": "treasurer",
      "title": "National Treasurer",
      "category": "general",
      "reason": "Constituency executive officer"
    },
    {
      "id": "organiser",
      "title": "National Organiser",
      "category": "general",
      "reason": "Constituency executive officer"
    },
    {
      "id": "communication",
      "title": "National Communication Officer",
      "category": "general",
      "reason": "Constituency executive officer"
    },
    {
      "id": "youth_organiser",
      "title": "National Youth Organiser",
      "category": "youth",
      "reason": "Ex-officio Youth Organiser portfolio"
    }
  ],
  "verifiedAt": "2026-09-15T19:25:00.000Z"
}
```

#### Error Response (`HTTP 401 Unauthorized`)
```json
{
  "success": false,
  "error": "Session expired or invalid. Please sign in with your Voter ID or Phone number."
}
```

#### Example cURL
```bash
curl -X GET https://your-domain.com/api/voting/confirmation \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..."
```

---

## 4. Constitutional Voting Entitlement Rules

The API enforces the official NPP National Constitution and Electoral College regulations:

| Category | Contested Portfolios | Who Is Entitled to Vote |
| :--- | :--- | :--- |
| **General Contests** (`general`) | - National Chairperson<br>- 1st Vice Chairperson<br>- 2nd Vice Chairperson<br>- General Secretary<br>- National Treasurer<br>- National Organiser<br>- National Communication Officer | 1. All **National** executives.<br>2. All **Regional** executives.<br>3. All **Constituency** executives.<br>4. All **External Branch** (Diaspora) executives.<br>5. **TESCON Institutional Presidents**.<br>*(Note: TESCON non-presidents do not vote in General Contests)*. |
| **Youth Wing** (`youth`) | - National Youth Organiser | 1. Any delegate holding a **Youth portfolio** (e.g. Youth Organiser, Deputy Youth Organiser).<br>2. **All TESCON tertiary executives** (excluding patrons).<br>3. Any core executive aged **under 40 in 2026** (`age < 40`). |
| **Women's Wing** (`women`) | - National Women Organiser | 1. All **female** core executives (National, Regional, Constituency, External Branch).<br>2. **TESCON Women Commissioners (WOCOM)**.<br>3. **Female TESCON Presidents**. |
| **Nasara Wing** (`nasara`) | - National Nasara Coordinator | 1. All **Nasara Coordinators** and **Deputy Nasara Coordinators** across National, Regional, Constituency, and TESCON levels. |
| **Non-Voting** | *None* | **TESCON Patrons** are advisory officers and are strictly excluded from voting. |

---

## 5. Web UI Page Routes (Ready-to-Use Frontend)

If your application redirects users to a web interface instead of consuming raw APIs, these responsive Next.js pages are ready:

- `/voting/login` - Clean mobile-optimized identification screen with Voter ID / Phone toggles.
- `/voting/otp` - 6-digit numeric verification input with countdown timer and resend support.
- `/voting/confirmation` - Full electoral confirmation dashboard with delegate card and authorized portfolio badges.

---

## 6. Client Implementation Examples

### JavaScript / TypeScript (Node.js or Browser)

```typescript
// 1. Send OTP
async function requestOtp(identifier: string) {
  const res = await fetch("https://your-domain.com/api/voting/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  });
  return await res.json();
}

// 2. Verify OTP and get Entitled Positions
async function verifyOtp(identifier: string, otp: string) {
  const res = await fetch("https://your-domain.com/api/voting/otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, otp }),
  });
  const data = await res.json();
  if (data.success) {
    console.log("Token:", data.token);
    console.log("Authorized Positions:", data.entitledPositions);
  }
  return data;
}

// 3. Retrieve Confirmation using Session Token
async function getConfirmation(token: string) {
  const res = await fetch("https://your-domain.com/api/voting/confirmation", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return await res.json();
}
```

### Python (3.x)

```python
import requests

BASE_URL = "https://your-domain.com"

# 1. Request OTP
def request_otp(identifier: str):
    res = requests.post(f"{BASE_URL}/api/voting/login", json={"identifier": identifier})
    return res.json()

# 2. Verify OTP
def verify_otp(identifier: str, otp: str):
    res = requests.post(f"{BASE_URL}/api/voting/otp", json={"identifier": identifier, "otp": otp})
    return res.json()

# 3. Get Confirmation
def get_confirmation(token: str):
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.get(f"{BASE_URL}/api/voting/confirmation", headers=headers)
    return res.json()
```

---

## 7. Security & Operational Notes

1. **Brute Force Protection**: Each OTP allows a maximum of 5 attempts. On the 5th failed attempt, the code is invalidated, requiring a fresh login.
2. **Replay Protection**: Verified OTPs are flagged immediately and cannot be re-used.
3. **Session Expiry**: Session tokens are cryptographically signed using HMAC SHA-256 and expire after 4 hours.
4. **Environment Variables**:
   - `SESSION_SECRET`: Secret key for signing tokens.
   - `ARKESEL_API_KEY`: API key for Ghana SMS delivery via Arkesel.
   - `SMS_SENDER_ID`: Custom alphanumeric SMS sender tag (default: `NPP ELECTIONS`).
