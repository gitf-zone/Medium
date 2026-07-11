# How to Debug a Machine That Dies Before It Can Tell You Why

## Subtitle: Six months of silent crashes, cracked by a log that left the building

### The ghost in the machine

For six months, my Arch Linux box had been dying on me. Not crashing in any polite, debuggable way — just *freezing*. Solid. Screen locked, keyboard dead, the works. I'd hard-reset it, dig through the logs afterwards, and find… nothing.

The journal just **stopped**, mid-sentence, on some boring routine line. No kernel panic. No out-of-memory kill. No stack trace. No warning. It was like reading a detective novel where the last page has been torn out — every single time.

I chased everything. The GPU driver. A KDE update. Mains voltage — I even put a smart plug inline to log the wall power, convinced the flat's dodgy electrics were browning it out. Nothing stuck. The freezes kept coming, and the gap between them was *shrinking*: four days, then two, then twenty hours. Something was accelerating, and I was flying blind.

### Why the logs kept lying to me

Here's the thing that took me embarrassingly long to internalise: **a machine can't write down how it died if the thing that's dying is its ability to write things down.**

`journald` — the Linux logging daemon — writes to disk. If the failure takes out the disk path (or the storage controller, or the whole box), the last few seconds of evidence never get saved. The journal doesn't end because nothing happened. It ends because the machine lost the ability to record that something was happening.

Local logging has a blind spot *exactly* when you need it most. I'd been interrogating a witness who goes unconscious at the moment of the crime.

So I needed the logs to leave the building **before** the disk was ever involved.

### Netconsole: the kernel's emergency broadcast

Linux has a wonderfully brutal little feature called **netconsole**. Instead of writing kernel messages to disk, it fires them straight at the network card and broadcasts them as UDP packets. No filesystem. No user-space. No disk. It hooks in low enough that it keeps talking even as the rest of the machine is falling over.

The catch: UDP is fire-and-forget. If nobody's *listening* on the network at the exact moment of death, the last words vanish into the ether. I needed an always-on receiver — one that would never, ever go down at the same time as the box it was watching.

And I had the perfect host hiding in plain sight: **my ISP router.** It runs 24/7, it's independent of my machine, and — crucially — it can run a tiny virtual machine. So I spun up a featherweight Debian VM on the router itself and gave it one job: sit there forever, catch every kernel message my box shouts, and write it to *its own* disk.

![Figure 1: The dying machine broadcasts its last words over the network, before its own disk is even in the loop. The watchtower lives on separate hardware that never goes down with it.](https://raw.githubusercontent.com/gitf-zone/Medium/main/images/figure-1-the-dying-machine-broadcasts-its-last-words-over-the-network-before-its-own-disk-is-even-in-the-loop-the-watchtower-lives-on-separate-hardware-that-never-goes-down-with-it.png)
*Figure 1: The dying machine broadcasts its last words over the network, before its own disk is even in the loop. The watchtower lives on separate hardware that never goes down with it.*

While I was at it, I gave the little watchtower two more sensors: it pings the box every few seconds to timestamp the *exact* moment of death, and it polls the smart plug once a minute to log the mains voltage. Three independent black boxes, all off-site, all surviving whatever kills the main machine.

### The day it paid off

I finished wiring up the watchtower on a Tuesday. It caught a freeze **that same afternoon.**

Six months of torn-out final pages — and here, for the first time, was the full last chapter. The mains log was rock-steady through the whole event (there goes my electrical theory). The liveness log stamped the exact second the box went dark. And the kernel's dying broadcast, captured over the wire, said this:

```
nvme nvme0: controller is down; will reset: CSTS=0xffffffff
nvme 0000:02:00.0: Unable to change power state from D3cold to D0, device inaccessible
nvme nvme0: Disabling device after reset failure: -19
```

There it was. My NVMe SSD had dropped into **D3cold** — the deepest PCIe power-saving sleep — and *failed to wake up*. `CSTS=0xffffffff` is the reading you get when a device has physically fallen off the bus: all ones, nobody home. The drive went to sleep and simply never came back, and the operating system collapsed the instant it needed to read from a disk that no longer existed.

Every stubborn detail of those six months suddenly clicked into place. Freezes always happened at **idle**? Of course — D3cold is a state you only reach when nothing's going on. Never a mark on the drive's health stats? It wasn't dying hardware; it was a power-management handshake that occasionally hung. "The disk seems to die first"? It literally left the bus.

The best part: the kernel had been quietly suggesting the fix in that very same message. One boot parameter to forbid the drive from entering the state it couldn't wake from:

```
nvme_core.default_ps_max_latency_us=0
```

One line. Six months.

### The lesson worth keeping

I'm being honest with myself here: this is one captured crash, and the fix is now an experiment running while I'm away for a few days. If the box sails past its old survival record, the case is closed. If it freezes again, my watchtower will catch *that* too — which is rather the point.

Because the real win wasn't the kernel parameter. It was realising that **the most important logs are the ones that survive the failure.** Any monitoring that lives on the same machine, on the same disk, in the same failure domain, will always have a blind spot precisely where you're looking. Get your telemetry onto independent hardware — a spare Pi, a NAS, the router gathering dust in the corner — and point it at the thing most likely to fall over.

For six months my machine couldn't tell me how it was dying. It turned out it had been shouting the answer the whole time. I just hadn't put anyone outside the building to listen.
