# ແຜນຜັງລະບົບ LIS (Laboratory Information System)

## ຄຳອະທິບາຍ
ໄຟລ໌ນີ້ແມ່ນແຜນຜັງລະບົບ LIS ທີ່ສາມາດເບິ່ງໄດ້ດ້ວຍ Mermaid Viewer
Website: https://mermaid.live/

---

## 1. ແຜນຜັງການເຂົ້າສູ່ລະບົບ (Login Flow)

```mermaid
flowchart TD
    A[🔐 ໜ້າເຂົ້າສູ່ລະບົບ] --> B{ປ້ອນ<br/>Username/Password}
    B -->|ມີຂໍ້ມູນ| C[✅ ກວດສອບຖານຂໍ້ມູນ]
    B -->|ບໍ່ມີຂໍ້ມູນ| D[❌ ສະແດງຂໍ້ຜິດພາດ]
    C --> E{ກວດສອບສິດ?}
    E -->|Admin| F[👑 ສິດເຕັມທີ່<br/>ທຸກໝວດ]
    E -->|User| G[👤 ສິດຈຳກັດ<br/>ບາງໝວດ]
    E -->|ຜິດ| D
    F --> H[📊 ໜ້າ Dashboard]
    G --> I[📝 ໜ້າສັ່ງກວດ]
    D --> B
```

---

## 2. ແຜນຜັງການສັ່ງກວດ (Test Order Flow)

```mermaid
flowchart TD
    A[📋 ເລີ່ມສັ່ງກວດ] --> B[1️⃣ ປ້ອນ Patient ID]
    B --> C{ຄົ້ນຫາ<br/>ຖານຂໍ້ມູນ}
    C -->|ພົບ| D[✅ ດຶງຂໍ້ມູນຄົນເຈັບ<br/>ຊື່, ອາຍຸ, ເພດ]
    C -->|ບໍ່ພົບ| E[➕ ສ້າງຄົນເຈັບໃໝ່]
    D --> F[2️⃣ ເລືອກລາຍການກວດ]
    E --> F
    F --> G{ປະເພດ?}
    G -->|Normal| H[☑️ ເລືອກລາຍການດ່ຽວ]
    G -->|Package| I[📦 ເລືອກ Package]
    H --> J[3️⃣ ເພີ່ມໃສ່ຕະກຣ້າ]
    I --> J
    J --> K[4️⃣ ກວດສອບສະຕັອກນ້ຳຢາ]
    K --> L{ສະຕັອກພໍ?}
    L -->|ພໍ| M[5️⃣ ບັນທຶກໃບສັ່ງກວດ]
    L -->|ບໍ່ພໍ| N[⚠️ ແຈ້ງເຕືອນນ້ຳຢາບໍ່ພໍ]
    M --> O[6️⃣ ສ້າງເລກທີ Order]
    O --> P[7️⃣ ຕັດສະຕັອກນ້ຳຢາ FIFO]
    P --> Q[8️⃣ ພິມສະຕິກເກີ]
    Q --> R[9️⃣ ບັນທຶກ Audit Log]
    N --> F
```

---

## 3. ແຜນຜັງການຈັດການສາງນ້ຳຢາ (Inventory Flow)

```mermaid
flowchart TD
    A[📦 ຈັດການສາງນ້ຳຢາ] --> B{ເລືອກຫົວຂໍ້}
    
    B -->|1. ເພີ່ມນ້ຳຢາໃໝ່| C[➕ ເພີ່ມ Reagent Master]
    C --> D[ປ້ອນຊື່ ແລະ ຫົວໜ່ວຍ]
    D --> E[ບັນທຶກລົງ Stock Master]
    
    B -->|2. ຮັບເຂົ້າ Lot ໃໝ່| F[📥 ຮັບເຂົ້າສິນຄ້າ]
    F --> G[ປ້ອນຂໍ້ມູນ Lot]
    G --> H[ຊື່ນ້ຳຢາ, Lot No,<br/>ຜູ້ສະໜອງ, ວັນໝົດອາຍຸ]
    H --> I[ສ້າງ Lot ID ອັດຕະໂນມັດ]
    I --> J[ບັນທຶກເຂົ້າ Inventory Lots]
    J --> K[ບັນທຶກ IN Transaction]
    
    B -->|3. ເບີກນ້ຳຢາ| L[📤 ເບີກນ້ຳຢາອອກ]
    L --> M[ເລືອກນ້ຳຢາ ແລະ ຈຳນວນ]
    M --> N[ຕັດສະຕັອກແບບ FIFO]
    N --> O[ບັນທຶກ OUT Transaction]
    
    B -->|4. ຕິດຕາມສະຖານະ| P[👁️ ກວດສອບສະຖານະ]
    P --> Q{ກວດສອບວັນໝົດອາຍຸ}
    Q -->|< 30 ມື້| R[⚠️ ແຈ້ງເຕືອນ Expiring Soon]
    Q -->|ໝົດແລ້ວ| S[🚫 ແຈ້ງເຕືອນ Expired]
    Q -->|ສະຕັອກໝົດ| T[❌ ແຈ້ງເຕືອນ Out of Stock]
    Q -->|ປົກກະຕິ| U[✅ Normal]
    
    K --> V[ອັບເດດສະຖານະ Real-time]
    O --> V
    R --> V
    S --> V
    T --> V
    U --> V
```

---

## 4. ແຜນຜັງ Dashboard Analytics

```mermaid
flowchart TD
    A[📊 Dashboard Analytics] --> B[1️⃣ ເລືອກຊ່ວງວັນທີ]
    B --> C{ເລືອກຕົວເລືອກ}
    C -->|ມື້ນີ້| D[ໂຫຼດຂໍ້ມູນວັນນີ້]
    C -->|ອາທິດນີ້| E[ໂຫຼດຂໍ້ມູນ 7 ມື້]
    C -->|ເດືອນນີ້| F[ໂຫຼດຂໍ້ມູນ 30 ມື້]
    C -->|ປີນີ້| G[ໂຫຼດຂໍ້ມູນ 12 ເດືອນ]
    
    D --> H[2️⃣ ໃສ່ຕົວກັ່ນຕອງ]
    E --> H
    F --> H
    G --> H
    
    H --> I{ເລືອກ Filter}
    I -->|ພະແນກ| J[ກັ່ນຕອງຕາມພະແນກ]
    I -->|ແພດ| K[ກັ່ນຕອງຕາມແພດ]
    I -->|ປະເພດກວດ| L[ກັ່ນຕອງ Normal/Package]
    I -->|ໝວດໝູ່| M[ກັ່ນຕອງຕາມ Category]
    
    J --> N[3️⃣ ຄິດໄລ່ KPIs]
    K --> N
    L --> N
    M --> N
    
    N --> O[ຈຳນວນບິນ Orders]
    N --> P[ລາຍຮັບລວມ]
    N --> Q[ລາຍຮັບ In-Lab]
    N --> R[ລາຍຮັບ Outsource]
    
    O --> S[4️⃣ ສ້າງກຣາຟ]
    P --> S
    Q --> S
    R --> S
    
    S --> T[🥧 Pie Chart: ເພດ, OPD/IPD]
    S --> U[📊 Bar Chart: ລາຍຮັບຕາມແພດ/ພະແນກ]
    S --> V[📈 Line Chart: ແນວໂນ້ມລາຍຮັບ]
    S --> W[⏰ Time Slot: ເຊົ້າ/ແລງ/ກະເດີກ]
    
    T --> X[5️⃣ ສະຫຼຸບຜົນ]
    U --> X
    V --> X
    W --> X
    
    X --> Y[Top 5 Tests]
    X --> Z[Top 5 Categories]
    X --> AA[Summary Table]
    
    AA --> AB[📄 Export PDF]
```

---

## 5. ແຜນຜັງການບຳລຸງຮັກສາເຄື່ອງຈັກ (Maintenance Flow)

```mermaid
flowchart TD
    A[🔧 ບຳລຸງຮັກສາເຄື່ອງຈັກ] --> B{ປະເພດການບຳລຸງ}
    
    B -->|Preventive| C[📅 ບຳລຸງຕາມແຜນ]
    B -->|Corrective| D[🔨 ບຳລຸງແກ້ໄຂບັນຫາ]
    
    C --> E[ກວດສອບວັນຄົບກຳນົດ]
    D --> F[ຮັບແຈ້ງບັນຫາ]
    
    E --> G[ນັດໝາຍວັນບຳລຸງ]
    F --> G
    
    G --> H[ປະຕິບັດການບຳລຸງ]
    H --> I[ບັນທຶກບັນຫາທີ່ພົບ]
    I --> J[ບັນທຶກການແກ້ໄຂ]
    J --> K[ກຳນົດວັນບຳລຸງຄັ້ງຕໍ່ໄປ]
    K --> L[ບັນທຶກລົງ Maintenance Log]
    L --> M[ສ້າງ Log ID ອັດຕະໂນມັດ]
    M --> N[ບັນທຶກ Audit Trail]
```

---

## 6. ແຜນຜັງໂຄງສ້າງຖານຂໍ້ມູນ (Database Schema)

```mermaid
erDiagram
    USERS ||--o{ AUDIT_LOG : "creates"
    USERS {
        bigint id PK
        text username
        text password
        text role
        timestamptz created_at
    }
    
    SETTINGS {
        bigint id PK
        text type
        text value
        timestamptz created_at
    }
    
    TEST_MASTER ||--o{ TEST_ORDERS : "ordered in"
    TEST_MASTER ||--o{ TEST_PACKAGE_ITEMS : "included in"
    TEST_MASTER ||--o{ TEST_REAGENT_MAPPING : "uses"
    TEST_MASTER {
        bigint id PK
        text name
        text category
        numeric price
        timestamptz created_at
    }
    
    TEST_PACKAGES ||--o{ TEST_PACKAGE_ITEMS : "contains"
    TEST_PACKAGES {
        bigint id PK
        text name
        text description
        numeric price
        boolean is_active
    }
    
    TEST_PACKAGE_ITEMS {
        bigint id PK
        bigint package_id FK
        bigint test_id FK
        text test_name
        numeric price
    }
    
    TEST_PARAMETERS {
        bigint id PK
        text test_name
        text param_name
        text input_type
        text options
        numeric normal_min
        numeric normal_max
    }
    
    TEST_REAGENT_MAPPING {
        bigint id PK
        text test_name
        bigint reagent_id FK
        text reagent_name
        numeric qty
    }
    
    STOCK_MASTER ||--o{ INVENTORY_LOTS : "has"
    STOCK_MASTER ||--o{ STOCK_TRANSACTIONS : "tracks"
    STOCK_MASTER {
        bigint id PK
        text name
        text unit
        timestamptz created_at
    }
    
    INVENTORY_LOTS {
        bigint id PK
        text lot_id
        bigint reagent_id FK
        text reagent_name
        text lot_no
        text supplier
        text location
        date receive_date
        date exp_date
        numeric qty
        numeric qty_remaining
    }
    
    STOCK_TRANSACTIONS {
        bigint id PK
        bigint reagent_id FK
        text reagent_name
        text type
        numeric qty
        text note
        text user_name
    }
    
    TEST_ORDERS ||--o{ TEST_RESULTS : "generates"
    TEST_ORDERS {
        bigint id PK
        text order_id
        timestamptz order_datetime
        text time_slot
        text visit_type
        text insite
        text patient_id
        text patient_name
        text age
        text gender
        text doctor
        text department
        text test_type
        text test_name
        numeric price
        numeric total_price
        text status
    }
    
    TEST_RESULTS {
        bigint id PK
        text order_id FK
        text test_name
        text param_name
        text result_value
        text flag
        text user_name
    }
    
    MAINTENANCE_LOG {
        bigint id PK
        text log_id
        date log_date
        text machine
        text type
        text issues
        text action
        date next_due
    }
    
    AUDIT_LOG {
        bigint id PK
        text user_name
        text action
        text target
        text details
        timestamptz created_at
    }
```

---

## 7. ແຜນຜັງຂັ້ນຕອນການເຮັດວຽກລວມ (End-to-End Process)

```mermaid
sequenceDiagram
    participant P as 👨‍🦱 ຄົນເຈັບ
    participant S as 👩‍💼 ພະນັກງານ
    participant L as 🧪 ລະບົບ LIS
    participant D as 🗄️ ຖານຂໍ້ມູນ
    participant I as 📦 Inventory
    
    P->>S: ມາຮັບບໍລິການກວດ
    S->>L: ເປີດໜ້າສັ່ງກວດ
    S->>L: ປ້ອນ Patient ID
    L->>D: ຄົ້ນຫາຂໍ້ມູນຄົນເຈັບ
    D-->>L: ສົ່ງຂໍ້ມູນຄົນເຈັບ
    L-->>S: ສະແດງຂໍ້ມູນຄົນເຈັບ
    
    S->>L: ເລືອກລາຍການກວດ
    L->>I: ກວດສອບສະຕັອກນ້ຳຢາ
    I-->>L: ຢືນຢັນສະຕັອກ
    S->>L: ບັນທຶກໃບສັ່ງກວດ
    
    L->>D: ບັນທຶກ Order
    D-->>L: ສ້າງ Order ID
    L->>I: ຕັດສະຕັອກນ້ຳຢາ (FIFO)
    I-->>L: ຢືນຢັນການຕັດສະຕັອກ
    L->>D: ບັນທຶກ Transaction
    
    L-->>S: ສະແດງ Order ID
    S->>L: ພິມສະຕິກເກີ
    L->>S: ສົ່ງຄຳສັ່ງພິມ
    
    S->>P: ມອບສະຕິກເກີ/ໃບຮັບເງິນ
    P->>S: ຊຳລະເງິນ
    
    Note over L,D: ຫຼັງຈາກກວດເສັດ
    S->>L: ປ້ອນຜົນກວດ
    L->>D: ບັນທຶກຜົນກວດ
    D-->>L: ຢືນຢັນການບັນທຶກ
    L->>S: ສະແດງຜົນກວດ (H/L/Normal)
    S->>L: ພິມຜົນກວດ
    S->>P: ມອບຜົນກວດ
```

---

## 8. ແຜນຜັງສິດການໃຊ້ງານ (User Permission Matrix)

```mermaid
graph LR
    A[👥 ຜູ້ໃຊ້ລະບົບ] --> B[👑 Admin]
    A --> C[👤 User]
    
    B --> D[✅ Dashboard]
    B --> E[✅ ສັ່ງກວດ]
    B --> F[✅ ປະຫວັດສັ່ງກວດ]
    B --> G[✅ ຕິດຕາມຜົນນອກ]
    B --> H[✅ ສາງນ້ຳຢາ]
    B --> I[✅ ບຳລຸງຮັກສາ]
    B --> J[✅ ຕັ້ງຄ່າລະບົບ]
    B --> K[✅ ຕັ້ງຄ່າຜົນກວດ]
    
    C --> L[❌ Dashboard]
    C --> M[✅ ສັ່ງກວດ]
    C --> N[✅ ປະຫວັດສັ່ງກວດ]
    C --> O[❌ ຕິດຕາມຜົນນອກ]
    C --> P[✅ ສາງນ້ຳຢາ]
    C --> Q[✅ ບຳລຸງຮັກສາ]
    C --> R[❌ ຕັ້ງຄ່າລະບົບ]
    C --> S[❌ ຕັ້ງຄ່າຜົນກວດ]
```

---

## 9. ແຜນຜັງການແຈ້ງເຕືອນ (Alert System Flow)

```mermaid
flowchart TD
    A[🔔 ລະບົບແຈ້ງເຕືອນ] --> B{ກວດສອບທຸກໆ 10 ນາທີ}
    
    B --> C[ກວດສອບນ້ຳຢາ]
    B --> D[ກວດສອບ Order]
    B --> E[ກວດສອບ Maintenance]
    
    C --> F{ສະຖານະນ້ຳຢາ?}
    F -->|ໝົດອາຍຸແລ້ວ| G[🚫 Expired<br/>ແດງ]
    F -->|< 30 ມື້| H[⚠️ Expiring Soon<br/>ເຫຼືອງ]
    F -->|ສະຕັອກໝົດ| I[❌ Out of Stock<br/>ແດງ]
    F -->|ປົກກະຕິ| J[✅ Normal<br/>ຂຽວ]
    
    D --> K{Status Order?}
    K -->|Pending ດົນ| L[⏳ ຄ້າງດຳເນີນການ<br/>ສົ້ມ]
    K -->|Completed| M[✅ ສຳເລັດ<br/>ຂຽວ]
    
    E --> N{ວັນຄົບກຳນົດ?}
    N -->|ເກີນກຳນົດ| O[🔴 ຄວນບຳລຸງແລ້ວ<br/>ແດງ]
    N -->|ໃກ້ຄົບກຳນົດ| P[🟡 ເຕືອນລ່ວງໜ້າ<br/>ເຫຼືອງ]
    N -->|ຍັງບໍ່ເຖິງ| Q[🟢 ປົກກະຕິ<br/>ຂຽວ]
    
    G --> R[ສະແດງ Badge ດ້ານເທິງ]
    H --> R
    I --> R
    L --> R
    O --> R
    P --> R
    
    R --> S[🔊 ສຽງແຈ້ງເຕືອນ]
    R --> T[📱 Popup ແຈ້ງເຕືອນ]
```

---

## 10. ແຜນຜັງ Time Slot Analysis

```mermaid
flowchart LR
    A[⏰ Time Slot Analysis] --> B{ເລືອກຊ່ວງເວລາ}
    
    B -->|ທັງໝົດ| C[ສະແດງທັງ 3 ຊ່ວງ]
    B -->|ເຊົ້າ| D[08:00-16:00<br/>🌅]
    B -->|ແລງ| E[16:00-21:00<br/>🌆]
    B -->|ກະເດີກ| F[21:00-08:00<br/>🌙]
    
    C --> G[ຄິດໄລ່ສະຖິຕິ]
    D --> G
    E --> G
    F --> G
    
    G --> H[ຈຳນວນບິນ]
    G --> I[ລາຍຮັບ]
    G --> J[ສະເລ່ຍ/ບິນ]
    
    H --> K[📊 Bar Chart]
    I --> L[📈 Line Chart]
    J --> M[📋 Summary Table]
    
    K --> N[ສົງເຄາະຜົນ]
    L --> N
    M --> N
    
    N --> O[ຊ່ວງເຊົ້າ: ມັກມີບິນຫຼາຍທີ່ສຸດ]
    N --> P[ຊ່ວງແລງ: ປານກາງ]
    N --> Q[ຊ່ວງກະເດີກ: ນ້ອຍທີ່ສຸດ<br/>ແຕ່ລາຍຮັບສູງ]
```

---

## ວິທີໃຊ້ໄຟລ໌ນີ້

1. **ເບິ່ງແຜນຜັງອອນລາຍ**: ໄປທີ່ https://mermaid.live/
2. **Copy-Paste**: ຄັດລອກໂຄ້ດ Mermaid ແຕ່ລະສ່ວນໄປວາງ
3. **Export**: ບັນທຶກເປັນ PNG, SVG ຫຼື PDF

---

## ຂໍ້ມູນເພີ່ມເຕີມ

- **Version**: 1.0
- **Last Updated**: 2026-03-31
- **System**: LIS Test By No V2
- **Database**: Supabase PostgreSQL
