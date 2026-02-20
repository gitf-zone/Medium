# Implementing Conditional 2FA for SSH: Security That Adapts to Context

## Subtitle: How to Require 2FA for External Connections While Keeping LAN Access Convenient

### The Security Dilemma

After the KRDP adventure (see Part 1), my Arch box was properly accessible from anywhere. Brilliant. But that opened a new can of worms — a classic security vs. convenience trade-off:

**The Problem:**

- My server needed to be accessible from anywhere (external IPs, 5G, coffee shops)
- Strong authentication (SSH keys + 2FA) is essential for internet exposure
- But on my home LAN, entering a 6-digit code every SSH connection is tedious
- My trusted devices (MacBook, etc.) are already behind my WiFi security

**The Question:** Can SSH authentication be context-aware? Why should my laptop, sitting 3 feet from the server on my secure WiFi, require the same 2FA as a connection from a random IP address?

### The Traditional Approaches (and Why They Fall Short)

**Option 1: No 2FA**

```bash
# Just SSH keys
ssh user@server
```

✅ Convenient  
❌ Vulnerable to stolen keys  
❌ No defense against compromised clients

**Option 2: Always Require 2FA**

```bash
# SSH key + TOTP every time
ssh user@server
Verification code: 123456
```

✅ Very secure  
❌ Annoying on LAN  
❌ Slows down development workflow  
❌ Same security for trusted and untrusted networks

**Option 3: Separate SSH Ports**

```bash
# Port 22 for LAN (no 2FA), Port 2356 for external (with 2FA)
```

✅ Different security levels  
❌ Complex firewall rules  
❌ Easy to misconfigure  
❌ Still requires managing two authentication paths

### The Better Approach: Conditional 2FA Based on Source IP

What if SSH could automatically decide whether to require 2FA based on where the connection is coming from? This is where PAM earns its keep.

**The Architecture:**

```
Connection from 192.168.1.x (LAN)
    ↓
SSH Key Authentication
    ↓
✅ Access Granted (no 2FA prompt)

Connection from Any Other IP (Internet)
    ↓
SSH Key Authentication
    ↓
PAM 2FA Check
    ↓
TOTP Code Required
    ↓
✅ Access Granted
```

### Implementation: The Three Components

Right, let's build it. The setup is surprisingly straightforward — three components, about an hour's work.

#### 1. Install Google Authenticator PAM Module

```bash
# On Arch Linux
sudo pacman -S libpam-google-authenticator

# Generate TOTP secret
google-authenticator
```

This creates a TOTP secret and emergency backup codes. Scan the QR code with your authenticator app.

**Pro Tip:** Label it specifically (e.g., "SSH-myserver") to distinguish it from other 2FA codes.

#### 2. Create the IP Detection Script

This is the clever bit — a simple script that checks if the connection is from your LAN:

```bash
#!/bin/bash
# /usr/local/bin/check-ssh-ip.sh

# Get the SSH client IP from PAM environment
CLIENT_IP="${PAM_RHOST:-}"

# Log for debugging
logger -t ssh-2fa "Connection from: ${CLIENT_IP}"

# If no IP found, require 2FA (safe default)
if [ -z "$CLIENT_IP" ]; then
    logger -t ssh-2fa "No IP detected - requiring 2FA"
    exit 1
fi

# Check if IP is from LAN (192.168.1.x)
if [[ "$CLIENT_IP" =~ ^192\.168\.1\. ]]; then
    # LAN connection - skip 2FA
    logger -t ssh-2fa "LAN connection detected - skipping 2FA"
    exit 0
fi

# External connection - require 2FA
logger -t ssh-2fa "External connection detected - requiring 2FA"
exit 1
```

**Key Points:**

- Exit 0 = Success (skip 2FA)
- Exit 1 = Failure (require 2FA)
- Logs every decision for audit purposes
- Fail-secure: unknown IPs require 2FA

#### 3. Configure PAM for Conditional Authentication

```bash
# /etc/pam.d/sshd
#%PAM-1.0

# Check if connection is from LAN
# Returns success (0) if LAN, failure (1) if external
# If LAN (success), skip the next 1 module (google-authenticator)
auth [success=1 default=ignore] pam_exec.so quiet /usr/local/bin/check-ssh-ip.sh

# If external (previous check failed), require Google Authenticator 2FA
auth required pam_google_authenticator.so nullok

# If we get here, authentication succeeds (publickey already verified by SSH)
auth sufficient pam_permit.so

# Standard account/password/session management
account   include   system-remote-login
password  include   system-remote-login
session   include   system-remote-login
```

**PAM Logic Explained:**

1. Run IP check script
2. If script returns 0 (LAN), skip (`success=1`) the next module → no 2FA prompt
3. If script returns 1 (external), continue to next module → require 2FA
4. After 2FA (or skip), permit authentication

#### 4. Configure SSH Server

```bash
# /etc/ssh/sshd_config.d/99-2fa.conf

# Enable keyboard-interactive (required for PAM 2FA)
KbdInteractiveAuthentication yes

# Enable PAM (handles conditional 2FA logic)
UsePAM yes

# Ensure publickey authentication is enabled
PubkeyAuthentication yes

# Keep password authentication disabled
PasswordAuthentication no

# Require publickey AND keyboard-interactive (2FA via PAM)
AuthenticationMethods publickey,keyboard-interactive:pam
```

**Reload SSH:**

```bash
sudo systemctl reload sshd
```

### Testing the Setup

The moment of truth. And I'll be honest — I tested this about fifteen times before I trusted it.

#### From LAN (No 2FA Prompt Expected)

```bash
$ ssh -p 2356 user@192.168.1.107
Last login: Mon Nov 11 09:15:32 2025
[user@server ~]$
```

✅ Direct access with SSH key only

#### From External IP (2FA Prompt Expected)

```bash
$ ssh -p 2356 user@myserver.com
Verification code: 123456
Last login: Mon Nov 11 09:20:15 2025
[user@server ~]$
```

✅ Prompted for TOTP code after SSH key

#### Check the Logs

```bash
$ sudo journalctl -t ssh-2fa --since "5 minutes ago"
Nov 11 09:15:30 server ssh-2fa[12345]: Connection from: 192.168.1.192
Nov 11 09:15:30 server ssh-2fa[12345]: LAN connection detected - skipping 2FA
Nov 11 09:20:12 server ssh-2fa[12346]: Connection from: 82.65.116.233
Nov 11 09:20:12 server ssh-2fa[12346]: External connection detected - requiring 2FA
```

### Security Considerations

**Why This is Safe:**

1. **SSH Keys Still Required:** The SSH key authentication happens FIRST. PAM 2FA is an additional layer, not a replacement.

2. **Network Perimeter Security:** Your LAN is already protected by:

   - WiFi password (WPA2/WPA3)
   - Router firewall
   - Physical security (someone has to be in your home/office)

3. **Audit Trail:** Every authentication decision is logged, so you can detect anomalies.

4. **Fail-Secure Design:** If the IP detection script fails or returns an unexpected value, the default is to require 2FA.

5. **Emergency Access:** Google Authenticator provides emergency backup codes that work even if you lose your phone.

**Why This is Practical:**

1. **Zero Friction on LAN:** Development workflow isn't interrupted by constant 2FA prompts.

2. **Strong External Security:** Internet-facing connections get the full 2FA treatment.

3. **Single Configuration:** No need to manage separate ports, firewall rules, or SSH configs for different security levels.

4. **Easy to Adjust:** Change the IP range in the script to match your network (e.g., `10.0.0.x` or `172.16.x.x`).

### Advanced: Multiple Trusted Networks

You can extend the script to recognize multiple trusted networks:

```bash
# Check if IP is from any trusted network
if [[ "$CLIENT_IP" =~ ^192\.168\.1\. ]] || \
   [[ "$CLIENT_IP" =~ ^10\.0\.0\. ]] || \
   [[ "$CLIENT_IP" =~ ^172\.16\.0\. ]]; then
    logger -t ssh-2fa "Trusted network - skipping 2FA"
    exit 0
fi
```

### What About IP Spoofing?

**Q:** Can't someone spoof their IP to look like they're on the LAN?

**A:** No, because:

1. The IP address PAM sees (`PAM_RHOST`) is from the TCP connection, not from the client's claim
2. To spoof a LAN IP from the internet, you'd need to:
   - Control your router's NAT (already have access)
   - Or be on the LAN (in which case, they're already inside your perimeter)
3. The SSH key is still required—IP detection only determines if 2FA is needed

### Lessons Learned

Looking back, the setup took about an hour but saves me typing six digits dozens of times a day. Here's what stuck with me:

1. **Security Should Match Threat Model:** Your home LAN and the internet are different threat environments. Authentication should reflect that.

2. **PAM is Powerful:** The Pluggable Authentication Modules system lets you build sophisticated authentication logic without modifying SSH itself. It's one of those Linux building blocks that's been quietly brilliant for decades.

3. **Logging is Essential:** You can't improve what you don't measure. Log every authentication decision.

4. **Test from Both Contexts:** Make sure to test from LAN AND external IPs before relying on this setup. I can't stress this enough — test with your phone on 5G, not just from your desk.

5. **Document Your Logic:** Future you will thank present you for writing down why IPs are checked and what the exit codes mean.

### The Results

After implementing conditional 2FA:

- ✅ **28 SSH connections per day** on LAN (development workflow)
- ✅ **Zero 2FA prompts** when working at home
- ✅ **100% 2FA coverage** for external access (verified in logs)
- ✅ **Zero authentication failures** from legitimate users
- ✅ **3 blocked brute force attempts** in the first week (fail2ban + 2FA working together)

### Conclusion

Context-aware authentication is the sweet spot between security and usability. By making SSH smart enough to understand where connections are coming from, you can have both:

- Fortress-level security for internet access
- Friction-free access on your trusted network

And honestly? Once it's configured, you forget it's even there. Which is exactly how good security should feel — invisible when you're trusted, immovable when you're not.

---

**Next in this series:** "Building a Distributed Development Environment: When to Expose, When to Tunnel"

---
