# The Quest for Perfect Remote Desktop on Arch Linux + KDE 6.2

## Subtitle: Why Guacamole Failed and How KRDP Saved the Day

### Introduction

My Linux box has become my main squeeze. For years, I didn't even consider this option—a MacBook is basically Linux, right? And I'll admit, it's still a cracking laptop. But about a year ago, something shifted. I built my own Linux machine from scratch. Arch Linux. Actually, I remember now—it started with a canteen chat that somehow drifted towards Black Arch, and hacking has always intrigued me...

But there's a snag: I'm not always home. And even when I am, that lovely 27" monitor has multiple fans (my fault—I put HDMI and USB-C cables everywhere for self-service). So there it is: I needed proper remote access to my KDE desktop.

So I decided to turn my Arch Linux box into a proper remote development server. Should be dead simple, right?

What followed was a week-long journey through compatibility issues, protocol limitations, and architectural decisions that taught me more about Linux remote access than any tutorial ever could.

Here's the story of how I went from zero to a production-ready remote access setup, and why sometimes the newest solution is actually the best one.

### The Requirements

My setup was simple on paper:

- **Server:** Arch Linux (latest, always rolling)
- **Desktop Environment:** KDE Plasma 6.2 on Wayland
- **Client:** MacBook Pro
- **Goal:** Seamless remote desktop access with good performance
- **Constraint:** Must work with Wayland (no X11 fallback) - native installation instead of containers for system tools

### Attempt #1: X2Go (The X11 Problem)

X2Go is a mature, well-documented remote desktop solution. The Arch Wiki has a great guide, and many people swear by it. Spent an afternoon or more getting it all configured. Launched it. Black screen. Brilliant.

**The Problem:** X2Go is fundamentally built on X11 technology. While KDE Plasma can run on X11, I was running Wayland for better performance and modern features. X2Go kept trying to start X11 sessions, leading to:

- Session startup failures
- Black screens
- Cryptic error messages about display servers

**The Lesson:** When your desktop environment has moved to Wayland, X11-based solutions aren't just legacy—they're incompatible. No amount of configuration will bridge that gap. I should've spotted this earlier, but hindsight's brilliant like that.

### Attempt #2: Apache Guacamole (The Browser Dream)

Right, Guacamole. I spent three solid days on this beast.

A browser-based remote desktop gateway that supports RDP, VNC, and SSH. The promise was compelling: access your desktop from any device with a web browser, no client software needed. Sounded perfect.

The setup marathon:

1. Set up Tomcat (Guacamole requires a Java servlet container)
2. Installed guacd (the Guacamole daemon)
3. Configured the database
4. Set up nginx as a reverse proxy
5. Generated SSL certificates

**The Problems:**

1. **Compilation Issues:** Guacamole's dependencies on Arch Linux required building from AUR, and the build process kept failing with obscure dependency conflicts
2. **KDE 6.2 Incompatibility:** Even when I got it running, Guacamole couldn't handle KDE's Wayland implementation properly
3. **Performance:** The VNC backend had noticeable lag, even on my local network
4. **Complexity:** The entire stack (Tomcat + guacd + database + nginx + SSL) was extremely heavy for what I needed

At this point, I had more tabs open about Tomcat errors than actual work. Not ideal.

**The Key Insight:** Sometimes browser-based solutions aren't the answer. The abstraction layers (VNC/RDP → guacd → HTTP → browser) introduced too much latency and complexity. The promise of "access from anywhere" wasn't worth the performance hit and maintenance nightmare.

### The Solution: KRDP (KDE Remote Desktop Protocol)

At this point, I was disappointed enough to give up and just SSH into everything. But then...

Enter KRDP—KDE's native remote desktop protocol. I was properly sceptical after the Guacamole saga, but have a look:

```bash
# On Arch (server)
sudo pacman -Syu krdp

# Enable the service
systemctl --user enable --now app-org.kde.krdpserver.service

# That's it.
```

![Figure 1: The Journey Through Remote Desktop Solutions](https://raw.githubusercontent.com/gitf-zone/Medium/main/images/figure-1-the-journey-through-remote-desktop-solutions.png)
*Figure 1: The Journey Through Remote Desktop Solutions*

**Why KRDP Works:**

1. **Native Wayland Support:** Built by the KDE team specifically for KDE Plasma on Wayland
2. **Standard Protocol:** Uses RDP (Remote Desktop Protocol), which is well-optimised and has excellent clients
3. **Security First:** Only listens on localhost by default—you must tunnel through SSH
4. **Zero Configuration:** Works out of the box with your existing KDE user credentials
5. **Performance:** Direct RDP connection with no translation layers

Properly sorted, in under ten minutes.

### The Architecture

The final setup is elegant:

```
MacBook → SSH Tunnel → localhost:3389 → KRDP → KDE Plasma (Wayland)
```

**On the server (Arch):**

```bash
# KRDP runs automatically with KDE
systemctl --user status app-org.kde.krdpserver.service
```

**On the client (MacBook):**

```bash
# Create SSH tunnel (port 3389 is RDP standard)
ssh -p 2222 -L 3389:localhost:3389 myuser@myserver.example.com

# Then connect with Microsoft Remote Desktop to localhost:3389
```

![Figure 2: KRDP Architecture (Final Solution)](https://raw.githubusercontent.com/gitf-zone/Medium/main/images/figure-2-krdp-architecture-final-solution.png)
*Figure 2: KRDP Architecture (Final Solution)*

### Why This Architecture is Better

1. **Security by Design:** KRDP only listens on localhost, so it's never exposed to the internet. SSH provides authentication and encryption. Proper defence in depth without the faff.

2. **One Port to Forward:** Only SSH port needs to be forwarded on your router. The RDP connection is tunnelled through SSH. Simple is secure.

3. **Mature Client Software:** Microsoft Remote Desktop (free on macOS App Store) is polished, feature-rich, and reliable. No janky browser interface.

4. **Low Latency:** Direct RDP protocol means minimal overhead—even on LAN, the difference is noticeable compared to VNC-based solutions. It's properly responsive, even over LTE when I'm out and about.

### Lessons Learned

Right, this is definitely going to happen again. I've got loads of ideas brewing—the Open Source and Linux world is so rich, I just lack a bit of time. So, speaking of not wasting too much of it, here are some lessons to apply next time:

1. **Start with Native Solutions:** Check what your desktop environment provides before reaching for third-party tools. KRDP should have been my first choice, not my last. The KDE team knows their stuff better than anyone else.

2. **Wayland is the Future:** Solutions that don't support Wayland are on borrowed time. If you're on Arch with KDE 6.x, plan for Wayland-only. X11 solutions? Forget it.

3. **Complexity is a Security Risk:** Every additional component (Tomcat, guacd, etc.) is another thing to configure, maintain, and secure. Simple solutions are often more secure. And definitely easier to debug at 11pm.

4. **Browser-Based ≠ Better:** The promise of "access from anywhere with no client" sounds great, but native clients are faster, more reliable, and often provide a better experience. Sometimes old-school desktop apps win.

5. **The Arch Wiki is Good, But...** Sometimes the cutting edge moves faster than documentation. KRDP was barely mentioned in remote access guides when I started, but it's the best solution for modern KDE. Worth checking the project's own docs too.

![Figure 3: Security Layers](https://raw.githubusercontent.com/gitf-zone/Medium/main/images/figure-3-security-layers.png)
*Figure 3: Security Layers*

### The Final Setup

After a week of trial and error, I have:

- ✅ Native KDE Plasma remote access
- ✅ Full Wayland support
- ✅ Secure SSH tunnelling
- ✅ Excellent performance (even over LTE)
- ✅ Professional RDP client on macOS
- ✅ Minimal complexity (no Tomcat, no VNC, no translation layers)

**Time to set up:** ~30 minutes (once you know what to use)  
**Time I actually spent:** ~1 week (learning what NOT to use)

Worth it? Absolutely. Would I do it again? Probably, knowing me.

### Conclusion

If you're running KDE Plasma 6.x on Arch Linux and need remote desktop access, skip the legacy solutions. KRDP is purpose-built for your exact use case, and the SSH tunnel approach provides excellent security without sacrificing performance.

Turns out sometimes the newest tool actually _is_ the right tool. Especially when it's built by the people who made your desktop in the first place. Who knew?

---

**Next in this series:** "Implementing Conditional 2FA: Why Your LAN Doesn't Need It, But the Internet Does"

---
