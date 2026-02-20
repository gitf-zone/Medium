
---

# Mermaid Diagrams for Medium Posts

## Post 1: Remote Desktop Journey

### Diagram 1: The Journey Through Remote Desktop Solutions

```mermaid
graph TD
    Start[Need Remote Desktop<br/>Arch Linux + KDE 6.2 Wayland] --> X2Go{Try X2Go}
    
    X2Go -->|X11 Only| X2GoFail[❌ Failed<br/>Wayland Incompatible<br/>Black screens<br/>Session errors]
    
    X2GoFail --> Guac{Try Guacamole}
    
    Guac -->|Browser-Based| GuacSetup[Setup Steps:<br/>1. Install Tomcat<br/>2. Build from AUR<br/>3. Configure Database<br/>4. nginx Proxy<br/>5. SSL Certs]
    
    GuacSetup -->|Complex| GuacFail[❌ Failed<br/>AUR build errors<br/>KDE 6.2 issues<br/>High latency<br/>Too complex]
    
    GuacFail --> KRDP{Try KRDP}
    
    KRDP -->|Native KDE| KRDPSuccess[✅ Success!<br/>5 min setup<br/>Native Wayland<br/>Standard RDP<br/>SSH tunnel security]
    
    style X2GoFail fill:#ffcccc
    style GuacFail fill:#ffcccc
    style KRDPSuccess fill:#ccffcc
```

### Diagram 2: KRDP Architecture (Final Solution)

```mermaid
graph LR
    subgraph "Client: MacBook"
        Mac[MacBook Pro]
        MRD[Microsoft Remote<br/>Desktop Client]
    end
    
    subgraph "SSH Tunnel"
        Mac -->|1. SSH Connection<br/>Port 2356| SSH[SSH Tunnel<br/>Encrypted]
        SSH -->|2. Forward<br/>Port 3389| Local[localhost:3389]
    end
    
    subgraph "Server: Arch Linux"
        Local -->|3. RDP Protocol| KRDP[KRDP Service<br/>Port 3389<br/>localhost only]
        KRDP -->|4. Display Protocol| Wayland[KDE Plasma 6.2<br/>Wayland]
    end
    
    Mac -.->|Security Layer| Auth[SSH Key + 2FA]
    
    style SSH fill:#e1f5ff
    style KRDP fill:#fff9e1
    style Wayland fill:#f0e1ff
    style Auth fill:#ffe1e1
```

### Diagram 3: Security Layers

```mermaid
graph TD
    Internet[Internet Access] --> Router[Router/Firewall<br/>Port 2356 Open]
    Router --> SSH[SSH Server<br/>Layer 1: Authentication<br/>✓ SSH Key Required<br/>✓ 2FA for External IPs]
    
    SSH --> Tunnel[SSH Tunnel<br/>Layer 2: Encryption<br/>✓ AES-256<br/>✓ Port Forwarding]
    
    Tunnel --> KRDP[KRDP Server<br/>Layer 3: RDP Auth<br/>✓ Username/Password<br/>✓ TLS Certificate]
    
    KRDP --> Desktop[KDE Desktop<br/>Full Access]
    
    LAN[LAN Access] --> Router
    
    style SSH fill:#ff9999
    style Tunnel fill:#ffcc99
    style KRDP fill:#ffff99
    style Desktop fill:#99ff99
```

---

## Post 2: Conditional 2FA Architecture

### Diagram 1: Authentication Decision Flow

```mermaid
flowchart TD
    Start([SSH Connection Attempt]) --> Key{SSH Key<br/>Valid?}
    
    Key -->|No| Deny1[❌ Deny<br/>Connection Closed]
    Key -->|Yes| CheckIP[Check Source IP<br/>PAM Script]
    
    CheckIP --> IsLAN{IP Match<br/>192.168.1.x?}
    
    IsLAN -->|Yes| LAN[✓ LAN Detected<br/>Trusted Network]
    IsLAN -->|No| External[⚠ External IP<br/>Untrusted Network]
    
    LAN --> SkipOTP[Skip 2FA<br/>success=1]
    External --> RequireOTP[Require TOTP<br/>Prompt User]
    
    SkipOTP --> Grant[✅ Access Granted<br/>Session Started]
    
    RequireOTP --> OTP{TOTP Code<br/>Valid?}
    OTP -->|No| Deny2[❌ Deny<br/>Connection Closed]
    OTP -->|Yes| Grant
    
    style Deny1 fill:#ffcccc
    style Deny2 fill:#ffcccc
    style Grant fill:#ccffcc
    style LAN fill:#e1f5ff
    style External fill:#ffe1e1
```

### Diagram 2: LAN vs External Access Comparison

```mermaid
graph TB
    subgraph "LAN Access (192.168.1.x)"
        L1[MacBook on WiFi] -->|1| L2[SSH Key Auth]
        L2 -->|2| L3[IP Check: LAN ✓]
        L3 -->|3| L4[Skip 2FA]
        L4 -->|4| L5[✅ Connected<br/>~50ms total]
    end
    
    subgraph "External Access (Internet)"
        E1[MacBook on 5G] -->|1| E2[SSH Key Auth]
        E2 -->|2| E3[IP Check: External ⚠]
        E3 -->|3| E4[Prompt TOTP]
        E4 -->|4| E5[User Enters Code]
        E5 -->|5| E6[Verify Code]
        E6 -->|6| E7[✅ Connected<br/>~5-10s total]
    end
    
    style L5 fill:#ccffcc
    style E7 fill:#ccffcc
    style L3 fill:#e1f5ff
    style E3 fill:#ffe1e1
```

### Diagram 3: PAM Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant SSH
    participant PAM
    participant Script as check-ssh-ip.sh
    participant Auth as google-authenticator
    participant User
    
    Client->>SSH: Connect with SSH key
    SSH->>SSH: Verify SSH key ✓
    SSH->>PAM: Start PAM authentication
    
    PAM->>Script: Execute IP check
    Script->>Script: Get PAM_RHOST
    Script->>Script: Check if 192.168.1.x
    
    alt LAN Connection
        Script->>PAM: Exit 0 (Success)
        PAM->>PAM: Skip next module (success=1)
        PAM->>SSH: Authentication complete
        SSH->>Client: Connected ✓
    else External Connection
        Script->>PAM: Exit 1 (Failure)
        PAM->>Auth: Run google-authenticator
        Auth->>Client: Prompt: "Verification code:"
        Client->>User: Show prompt
        User->>Client: Enter TOTP code
        Client->>Auth: Send code
        Auth->>Auth: Verify TOTP
        alt Valid Code
            Auth->>PAM: Success
            PAM->>SSH: Authentication complete
            SSH->>Client: Connected ✓
        else Invalid Code
            Auth->>PAM: Failure
            PAM->>SSH: Authentication failed
            SSH->>Client: Connection denied ✗
        end
    end
```

---

## Post 3: Distributed Development Architecture

### Diagram 1: Complete Network Architecture

```mermaid
graph TB
    subgraph Internet["☁️ Internet (Hostile)"]
        Ext[External Access<br/>Coffee Shop / 5G<br/>82.x.x.x]
    end

    subgraph Router["🔒 Home Network Perimeter"]
        FW[Freebox Router<br/>192.168.1.1<br/>WPA3 + Firewall]
    end

    subgraph LAN["🏠 Trusted LAN (192.168.1.0/24)"]
        direction TB

        subgraph Mac["💻 MacBook (192.168.1.192)"]
            Code[Dev Tools + Python Code<br/>Context-Aware]
        end

        subgraph Server["🖥️ Server (192.168.1.107)"]
            PG[(PostgreSQL<br/>:5432<br/>localhost only)]
            Neo[(Neo4j<br/>:7474 :7687<br/>localhost + LAN)]
            Ollama[Ollama LLM<br/>:11434<br/>RTX 5080 GPU]
            Nginx[nginx<br/>:443<br/>+ Authelia 2FA]
        end
    end

    Ext -.->|SSH Tunnel<br/>Port 2356<br/>+2FA| FW
    FW --> Server

    Code -->|Direct LAN| Neo
    Code -->|Direct LAN| Ollama
    Code -.->|SSH Tunnel<br/>when remote| Server

    PG -.->|localhost<br/>Unix socket| Server

    style LAN fill:#e8f5e9
    style Internet fill:#ffebee
    style Mac fill:#e3f2fd
    style Server fill:#fff3e0
```

### Diagram 2: Context-Aware Database Access

```mermaid
flowchart TD
    Start[Python Application<br/>Starts] --> Detect{Detect<br/>Context}
    
    Detect --> CheckHost{Check<br/>Hostname}
    
    CheckHost -->|gitf.zone| OnServer[Running on Server]
    CheckHost -->|Other| CheckLAN{Check<br/>LAN Access}
    
    CheckLAN -->|Can reach<br/>192.168.1.1| OnLAN[MacBook on LAN]
    CheckLAN -->|Cannot reach<br/>router| Remote[MacBook Remote]
    
    OnServer --> UseLocal[Connect:<br/>localhost:7687]
    OnLAN --> UseLAN[Connect:<br/>192.168.1.107:7687]
    Remote --> UseTunnel[Connect:<br/>localhost:7687<br/>via SSH tunnel]
    
    UseLocal --> DB[(Neo4j)]
    UseLAN --> DB
    UseTunnel --> DB
    
    style OnServer fill:#e1f5ff
    style OnLAN fill:#e8f5e9
    style Remote fill:#ffe1e1
    style DB fill:#fff9e1
```

### Diagram 3: Performance Comparison Matrix

```mermaid
graph LR
    subgraph Scenarios["Access Scenarios"]
        S1[Server<br/>localhost]
        S2[MacBook<br/>LAN Direct]
        S3[MacBook<br/>LAN Tunnel]
        S4[MacBook<br/>5G Tunnel]
    end
    
    subgraph Latency["Query Latency (1000 nodes)"]
        L1[45ms<br/>⚡ Baseline]
        L2[48ms<br/>⚡ +3ms]
        L3[52ms<br/>⚡ +7ms]
        L4[180ms<br/>🐌 +135ms]
    end
    
    subgraph Decision["Recommendation"]
        D1[✅ Use This]
        D2[✅ Direct OK]
        D3[⚠️ Unnecessary]
        D4[✅ Required]
    end
    
    S1 --> L1 --> D1
    S2 --> L2 --> D2
    S3 --> L3 --> D3
    S4 --> L4 --> D4
    
    style L1 fill:#ccffcc
    style L2 fill:#ccffcc
    style L3 fill:#ffffcc
    style L4 fill:#ffcccc
```

### Diagram 4: Security Layers by Access Type

```mermaid
graph TD
    subgraph "🏠 LAN Access (Trusted)"
        LAN1[MacBook on WiFi] --> LAN2[Direct Connection]
        LAN2 --> LAN3[Neo4j Auth Only]
        LAN3 --> LAN4[Data Access]
        
        LANSec[Security:<br/>✓ WiFi WPA3<br/>✓ Router Firewall<br/>✓ Physical Security<br/>✓ DB Password]
    end
    
    subgraph "☁️ External Access (Untrusted)"
        Ext1[MacBook on Internet] --> Ext2[SSH Tunnel]
        Ext2 --> Ext3[SSH Key + 2FA]
        Ext3 --> Ext4[Encrypted Channel]
        Ext4 --> Ext5[Neo4j Auth]
        Ext5 --> Ext6[Data Access]
        
        ExtSec[Security:<br/>✓ SSH Key Auth<br/>✓ TOTP 2FA<br/>✓ AES Encryption<br/>✓ Tunnel Isolation<br/>✓ DB Password]
    end
    
    subgraph "🌐 Web Access (Public)"
        Web1[Browser] --> Web2[HTTPS]
        Web2 --> Web3[Authelia 2FA]
        Web3 --> Web4[nginx Proxy]
        Web4 --> Web5[Neo4j Browser]
        
        WebSec[Security:<br/>✓ TLS/SSL<br/>✓ TOTP 2FA<br/>✓ Session Mgmt<br/>✓ Rate Limiting<br/>✓ fail2ban]
    end
    
    style LAN1 fill:#e8f5e9
    style Ext1 fill:#fff3e0
    style Web1 fill:#e3f2fd
    style LANSec fill:#c8e6c9
    style ExtSec fill:#ffecb3
    style WebSec fill:#bbdefb
```

### Diagram 5: The Complete Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Mac as MacBook<br/>(Client)
    participant Net as Network<br/>(LAN/Internet)
    participant SSH as SSH Tunnel<br/>(if remote)
    participant Server as Arch Server
    participant Neo as Neo4j<br/>(Database)
    
    User->>Mac: Run Python Code
    Mac->>Mac: Detect Context<br/>(hostname, network)
    
    alt On Server
        Mac->>Neo: Direct: localhost:7687
        Neo->>Mac: Query Results
    else On LAN
        Mac->>Net: Check 192.168.1.1
        Net->>Mac: Reachable ✓
        Mac->>Server: Direct: 192.168.1.107:7687
        Server->>Neo: Local Query
        Neo->>Server: Results
        Server->>Mac: Return Data
    else Remote
        Mac->>Net: Check 192.168.1.1
        Net->>Mac: Not Reachable ✗
        User->>Mac: Start SSH Tunnel
        Mac->>SSH: Connect (2FA)
        SSH->>Server: Authenticated ✓
        Mac->>SSH: localhost:7687
        SSH->>Server: Forward to Neo4j
        Server->>Neo: Query
        Neo->>Server: Results
        Server->>SSH: Encrypted Return
        SSH->>Mac: Decrypted Data
    end
    
    Mac->>User: Display Results
```

---

## How to Use These Diagrams in Medium

### Option 1: Render as Images
1. Go to https://mermaid.live/
2. Paste each diagram
3. Click "Export" → PNG or SVG
4. Upload to Medium

### Option 2: Use Medium's Code Blocks
Medium doesn't natively support Mermaid, but you can:
1. Include as code blocks with syntax highlighting
2. Add a note: "View interactive diagram at mermaid.live"

### Option 3: GitHub Integration
1. Create a GitHub repo with the diagrams
2. GitHub automatically renders Mermaid
3. Link to the repo from Medium

---

