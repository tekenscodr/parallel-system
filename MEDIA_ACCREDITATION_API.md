# NPP Media House & Press Accreditation API Guide

This document provides complete technical specifications for integrating with the **New Patriotic Party (NPP) Media House, Security, and Ushering Accreditation System**, matching the database table and API schema implemented across the NPP platform ecosystem.

---

## 1. Database Table Specification (`media_accreditations`)

The system uses the PostgreSQL table `media_accreditations` shared across projects:

```sql
CREATE TABLE IF NOT EXISTS media_accreditations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category TEXT NOT NULL DEFAULT 'MEDIA',
  name TEXT NOT NULL,
  gender TEXT NOT NULL,
  company TEXT NOT NULL,
  "roleTitle" TEXT,
  "assignedZone" TEXT,
  "serviceNumber" TEXT,
  "emergencyContact" TEXT,
  region TEXT NOT NULL,
  street TEXT NOT NULL,
  "ghanaPostAddress" TEXT NOT NULL,
  "idType" TEXT NOT NULL,
  "idNumber" TEXT NOT NULL,
  "voterId" TEXT,
  "profileImage" TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "accreditationCode" TEXT UNIQUE NOT NULL,
  "qrCodeData" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT media_accreditations_id_type_number_unique UNIQUE ("idType", "idNumber")
);
```

### Accreditation Categories & Code Prefixes

| Category | Code Prefix Format | Description | Example Company / Agency |
| :--- | :--- | :--- | :--- |
| **`MEDIA`** | `MED-2026-XXXXXX` | Media houses, TV, radio, print journalists, photojournalists | Joy FM, Citi TV, Daily Graphic, Peace FM |
| **`SECURITY`** | `SEC-2026-XXXXXX` | State security, VIP escort, Ghana Police, military liaison | Ghana Police Service, VIP Protection Unit |
| **`USHER`** | `USH-2026-XXXXXX` | Conference protocol, hall ushers, guest management | National Protocol Committee |

---

## 2. API Endpoints

### 2.1. Link Voter ID to Media Accreditation

Links an Electoral Commission Voter ID to an existing media house or press accreditation record.

- **URL**: `/api/accreditation/link`
- **Method**: `POST`
- **Content-Type**: `application/json`

#### Request Body
| Field | Type | Required | Description | Example |
| :--- | :---: | :---: | :--- | :--- |
| `idNumber` | string | **Yes** | Identification number of applicant. | `"GHA-712891920-1"` or `"GPS-99418"` |
| `voterId` | string | **Yes** | 10-digit EC Voter ID number to link. | `"1928472910"` |
| `idType` | string | *No* | Identification type (e.g. `ghana-card`, `service-id`, `voter-id`). | `"ghana-card"` |

#### Success Response (`HTTP 200 OK`)
```json
{
  "success": true,
  "message": "Voter record successfully linked to media accreditation.",
  "accreditation": {
    "id": "cmu360epw0000kp9ktwqxodqd",
    "category": "MEDIA",
    "name": "Kwame Kyeremeh",
    "gender": "Male",
    "company": "Joy FM / Multimedia Group",
    "roleTitle": "Senior Broadcast Journalist",
    "assignedZone": "Press Gallery & Plenary Floor",
    "serviceNumber": "MMG-4401",
    "emergencyContact": "0244112233",
    "region": "Greater Accra",
    "street": "Kokomlemle",
    "ghanaPostAddress": "GA-039-4411",
    "idType": "ghana-card",
    "idNumber": "GHA-712891920-1",
    "voterId": "1928472910",
    "profileImage": "https://cms.newpatrioticparty.org/uploads/kwame.webp",
    "phone": "0241234567",
    "email": "k.kyeremeh@multimedia.com.gh",
    "status": "PENDING",
    "accreditationCode": "MED-2026-06CB96",
    "createdAt": "2026-09-15T18:00:00.000Z",
    "updatedAt": "2026-09-16T11:00:00.000Z"
  }
}
```

#### Error Responses
- **`HTTP 400 Bad Request`**: Missing required fields.
- **`HTTP 404 Not Found`**: No media accreditation record matching the ID number.

---

### 2.2. Submit Media Accreditation Application

Registers a new media personnel, journalist, security officer, or protocol usher.

- **URL**: `/api/accreditation`
- **Method**: `POST`
- **Content-Type**: `application/json`

#### Request Body
```json
{
  "category": "MEDIA",
  "name": "Kwame Kyeremeh",
  "gender": "Male",
  "company": "Joy FM / Multimedia Group",
  "roleTitle": "Senior Broadcast Journalist",
  "assignedZone": "Press Gallery & Plenary Floor",
  "serviceNumber": "MMG-4401",
  "emergencyContact": "0244112233",
  "region": "Greater Accra",
  "street": "Kokomlemle",
  "ghanaPostAddress": "GA-039-4411",
  "idType": "ghana-card",
  "idNumber": "GHA-712891920-1",
  "phone": "0241234567",
  "email": "k.kyeremeh@multimedia.com.gh",
  "voterId": "1928472910"
}
```

#### Success Response (`HTTP 201 Created` or `HTTP 200 OK` if existing)
```json
{
  "success": true,
  "isExisting": false,
  "message": "Media accreditation submitted successfully.",
  "accreditation": {
    "id": "cuid-a1b2c3d4e5f6",
    "category": "MEDIA",
    "name": "Kwame Kyeremeh",
    "gender": "Male",
    "company": "Joy FM / Multimedia Group",
    "accreditationCode": "MED-2026-06CB96",
    "status": "PENDING",
    "voterId": "1928472910"
  }
}
```

---

### 2.3. Query Media Accreditation

Retrieves accreditation pass details by Accreditation Code, ID Number, or Voter ID.

- **URL**: `/api/accreditation`
- **Method**: `GET`
- **Query Parameters**:
  - `?code=MED-2026-06CB96`
  - `?idNumber=GHA-712891920-1`
  - `?voterId=1928472910`
  - `?category=MEDIA` (optional filter)

#### Example Request
```bash
curl -X GET "https://your-domain.com/api/accreditation?code=MED-2026-06CB96"
```

#### Success Response (`HTTP 200 OK`)
```json
{
  "success": true,
  "accreditation": {
    "id": "cmu360epw0000kp9ktwqxodqd",
    "category": "MEDIA",
    "name": "Kwame Kyeremeh",
    "company": "Joy FM / Multimedia Group",
    "accreditationCode": "MED-2026-06CB96",
    "voterId": "1928472910",
    "status": "PENDING"
  }
}
```

---

## 3. Example Code Snippets

### Node.js / JavaScript Fetch
```javascript
// Link Voter ID to Media Accreditation
async function linkMediaAccreditation(idNumber, voterId) {
  const response = await fetch('/api/accreditation/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idNumber,
      voterId,
      idType: 'ghana-card'
    })
  });
  return await response.json();
}
```

### Python
```python
import requests

def link_voter_accreditation(base_url, id_number, voter_id):
    url = f"{base_url}/api/accreditation/link"
    payload = {
        "idNumber": id_number,
        "voterId": voter_id,
        "idType": "ghana-card"
    }
    res = requests.post(url, json=payload)
    return res.json()
```
