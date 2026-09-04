(function () {
  "use strict";

  const ACTIVE_RIDE_STATUSES = new Set([
    "accepted",
    "driver_arriving",
    "in_progress",
  ]);
  const TERMINAL_SIGNALS = new Set(["decline", "hangup"]);
  const RING_TIMEOUT_MS = 45_000;
  const RECENT_SIGNAL_SECONDS = 75;
  const FALLBACK_ICE_SERVERS = [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
      ],
    },
  ];

  const byId = (id) => document.getElementById(id);
  const uuid = () =>
    crypto.randomUUID?.() ||
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const value = (Math.random() * 16) | 0;
      return (char === "x" ? value : (value & 3) | 8).toString(16);
    });

  class VasiVoiceCall {
    constructor(options) {
      this.client = options.client;
      this.session = options.session;
      this.ride = options.ride;
      this.rideId = options.rideId;
      this.partner = options.partnerLabel || "Ride partner";
      this.active = ACTIVE_RIDE_STATUSES.has(String(this.ride?.status || ""));
      this.callId = null;
      this.direction = null;
      this.peer = null;
      this.localStream = null;
      this.channel = null;
      this.pendingIce = [];
      this.ringTimer = null;
      this.durationTimer = null;
      this.startedAt = null;
      this.muted = false;
      this.ending = false;
      this.iceServers = FALLBACK_ICE_SERVERS;
    }

    text(value) {
      return window.VasiLanguage?.translate?.(value) || value;
    }

    setText(id, value) {
      const node = byId(id);
      if (node) node.textContent = this.text(value);
    }

    showPanel(show = true) {
      byId("voiceCall")?.classList.toggle("hidden", !show);
    }

    setMode(mode) {
      ["incomingCallActions", "activeCallActions"].forEach((id) =>
        byId(id)?.classList.add("hidden"),
      );
      if (mode === "incoming") byId("incomingCallActions")?.classList.remove("hidden");
      if (mode === "active") byId("activeCallActions")?.classList.remove("hidden");
    }

    status(title, detail) {
      this.setText("callTitle", title);
      this.setText("callState", detail);
    }

    async init() {
      const button = byId("callButton");
      if (!button || !this.client || !this.session || !this.rideId) return this;
      button.classList.toggle("hidden", !this.active || !this.ride?.driver_id);
      button.onclick = () => this.startOutgoing();
      byId("answerCall").onclick = () => this.answer();
      byId("declineCall").onclick = () => this.decline();
      byId("endCall").onclick = () => this.hangup(true);
      byId("muteCall").onclick = () => this.toggleMute();
      await this.loadIceServers();
      this.subscribe();
      await this.restoreRecentInvite();
      return this;
    }

    async loadIceServers() {
      try {
        const response = await fetch("/api/call-config", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${this.session.access_token}` },
        });
        const data = await response.json();
        if (response.ok && Array.isArray(data.iceServers) && data.iceServers.length) {
          this.iceServers = data.iceServers;
        }
      } catch (_) {
        this.iceServers = FALLBACK_ICE_SERVERS;
      }
    }

    subscribe() {
      this.channel = this.client
        .channel(`vasi-ride-call-${this.rideId}-${this.session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "ride_call_signals",
            filter: `ride_id=eq.${this.rideId}`,
          },
          (event) => this.handleSignal(event.new),
        )
        .subscribe();
    }

    async restoreRecentInvite() {
      try {
        const since = new Date(Date.now() - RECENT_SIGNAL_SECONDS * 1000).toISOString();
        const { data, error } = await this.client
          .from("ride_call_signals")
          .select("id,ride_id,call_id,sender_id,signal_type,payload,created_at")
          .eq("ride_id", this.rideId)
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .limit(100);
        if (error || !data?.length) return;
        const terminalCalls = new Set(
          data.filter((row) => TERMINAL_SIGNALS.has(row.signal_type)).map((row) => row.call_id),
        );
        const requestedCall = new URLSearchParams(location.search).get("incoming");
        const invite = [...data]
          .reverse()
          .find(
            (row) =>
              row.signal_type === "invite" &&
              row.sender_id !== this.session.user.id &&
              !terminalCalls.has(row.call_id) &&
              (!requestedCall || requestedCall === row.call_id),
          );
        if (invite) this.showIncoming(invite);
      } catch (_) {}
    }

    async signal(signalType, payload = {}) {
      if (!this.callId) return false;
      const { error } = await this.client.from("ride_call_signals").insert({
        ride_id: this.rideId,
        call_id: this.callId,
        signal_type: signalType,
        payload,
      });
      if (error) throw error;
      return true;
    }

    async requestMicrophone() {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Voice calls are not supported by this browser.");
      }
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (error) {
        if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
          throw new Error("Allow microphone access in your phone settings, then try again.");
        }
        throw new Error("The microphone could not be started. Please try again.");
      }
    }

    createPeer() {
      if (this.peer) return this.peer;
      this.peer = new RTCPeerConnection({ iceServers: this.iceServers });
      this.localStream?.getTracks().forEach((track) =>
        this.peer.addTrack(track, this.localStream),
      );
      this.peer.ontrack = (event) => {
        const audio = byId("remoteAudio");
        if (!audio) return;
        audio.srcObject = event.streams[0] || new MediaStream([event.track]);
        audio.play().catch(() => {});
      };
      this.peer.onicecandidate = (event) => {
        if (!event.candidate || !this.callId) return;
        this.signal("ice", { candidate: event.candidate.toJSON() }).catch(() => {});
      };
      this.peer.onconnectionstatechange = () => {
        const state = this.peer?.connectionState;
        if (state === "connected") this.connected();
        if (["failed", "closed"].includes(state)) this.finish("Call ended");
        if (state === "disconnected") {
          this.status("Voice call", "Reconnecting…");
          setTimeout(() => {
            if (this.peer?.connectionState === "disconnected") this.finish("Call ended");
          }, 8_000);
        }
      };
      return this.peer;
    }

    async startOutgoing() {
      if (!this.active || this.callId) return;
      this.showPanel(true);
      this.setMode("active");
      this.status(`${this.text("Calling")} ${this.text(this.partner)}…`, "Starting microphone…");
      try {
        await this.requestMicrophone();
        this.callId = uuid();
        this.direction = "outgoing";
        this.createPeer();
        await this.signal("invite", { version: 1, media: "audio" });
        this.status(`${this.text("Calling")} ${this.text(this.partner)}…`, "Waiting for an answer");
        this.startRingTimeout();
      } catch (error) {
        this.finish(error.message || "Call could not be started.");
      }
    }

    showIncoming(row) {
      if (!this.active || this.callId) return;
      this.callId = row.call_id;
      this.direction = "incoming";
      this.showPanel(true);
      this.setMode("incoming");
      this.status("Incoming voice call", `${this.text(this.partner)} ${this.text("is calling")}`);
      navigator.vibrate?.([180, 90, 180, 90, 300]);
      this.startRingTimeout();
    }

    async answer() {
      if (!this.callId || this.direction !== "incoming") return;
      this.setMode("active");
      this.status("Connecting…", "Starting microphone…");
      try {
        await this.requestMicrophone();
        this.createPeer();
        await this.signal("ready", { media: "audio" });
        this.status("Connecting…", `${this.text("Joining")} ${this.text(this.partner)}`);
      } catch (error) {
        await this.signal("decline", { reason: "microphone_unavailable" }).catch(() => {});
        this.finish(error.message || "Call could not be answered.");
      }
    }

    async decline() {
      if (!this.callId) return;
      await this.signal("decline", { reason: "declined" }).catch(() => {});
      this.finish("Call declined");
    }

    async handleSignal(row) {
      if (!row || row.ride_id !== this.rideId || row.sender_id === this.session.user.id) return;
      if (row.signal_type === "invite") {
        this.showIncoming(row);
        return;
      }
      if (!this.callId || row.call_id !== this.callId) return;
      try {
        if (row.signal_type === "ready" && this.direction === "outgoing") {
          const peer = this.createPeer();
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          await this.signal("offer", { sdp: peer.localDescription.toJSON() });
          this.status("Connecting…", `${this.text("Joining")} ${this.text(this.partner)}`);
        } else if (row.signal_type === "offer" && this.direction === "incoming") {
          const peer = this.createPeer();
          await peer.setRemoteDescription(row.payload?.sdp);
          await this.flushPendingIce();
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await this.signal("answer", { sdp: peer.localDescription.toJSON() });
        } else if (row.signal_type === "answer" && this.direction === "outgoing") {
          await this.peer?.setRemoteDescription(row.payload?.sdp);
          await this.flushPendingIce();
        } else if (row.signal_type === "ice" && row.payload?.candidate) {
          if (this.peer?.remoteDescription) await this.peer.addIceCandidate(row.payload.candidate);
          else this.pendingIce.push(row.payload.candidate);
        } else if (row.signal_type === "decline") {
          this.finish("Call declined");
        } else if (row.signal_type === "hangup") {
          this.finish("Call ended");
        }
      } catch (_) {
        await this.hangup(false);
        this.finish("Call connection failed. Please try again.");
      }
    }

    async flushPendingIce() {
      const candidates = this.pendingIce.splice(0);
      for (const candidate of candidates) await this.peer?.addIceCandidate(candidate);
    }

    startRingTimeout() {
      clearTimeout(this.ringTimer);
      this.ringTimer = setTimeout(async () => {
        if (!this.startedAt) {
          await this.signal("hangup", { reason: "no_answer" }).catch(() => {});
          this.finish("No answer");
        }
      }, RING_TIMEOUT_MS);
    }

    connected() {
      if (this.startedAt) return;
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
      this.startedAt = Date.now();
      this.status("Voice call", `${this.text("Connected")} · 00:00`);
      this.durationTimer = setInterval(() => {
        const total = Math.floor((Date.now() - this.startedAt) / 1000);
        const minutes = String(Math.floor(total / 60)).padStart(2, "0");
        const seconds = String(total % 60).padStart(2, "0");
        this.setText("callState", `${this.text("Connected")} · ${minutes}:${seconds}`);
      }, 1000);
    }

    toggleMute() {
      this.muted = !this.muted;
      this.localStream?.getAudioTracks().forEach((track) => {
        track.enabled = !this.muted;
      });
      const button = byId("muteCall");
      if (button) button.textContent = this.text(this.muted ? "Unmute" : "Mute");
    }

    async hangup(notifyPartner) {
      if (this.ending) return;
      this.ending = true;
      if (notifyPartner && this.callId) {
        await this.signal("hangup", { reason: "ended" }).catch(() => {});
      }
      this.finish("Call ended");
      this.ending = false;
    }

    finish(message) {
      clearTimeout(this.ringTimer);
      clearInterval(this.durationTimer);
      this.ringTimer = null;
      this.durationTimer = null;
      this.startedAt = null;
      this.peer?.close();
      this.peer = null;
      this.localStream?.getTracks().forEach((track) => track.stop());
      this.localStream = null;
      const audio = byId("remoteAudio");
      if (audio) audio.srcObject = null;
      this.pendingIce = [];
      this.callId = null;
      this.direction = null;
      this.muted = false;
      const mute = byId("muteCall");
      if (mute) mute.textContent = this.text("Mute");
      this.status("Voice call", message || "Call ended");
      this.setMode("active");
      setTimeout(() => {
        if (!this.callId) this.showPanel(false);
      }, 1300);
    }

    async destroy() {
      if (this.callId) await this.signal("hangup", { reason: "left_chat" }).catch(() => {});
      this.finish("Call ended");
      if (this.channel) await this.client.removeChannel(this.channel).catch(() => {});
      this.channel = null;
    }
  }

  window.VasiVoiceCall = {
    async init(options) {
      const call = new VasiVoiceCall(options);
      return call.init();
    },
  };
})();
