# SoNex — NotebookLM Podcast Script
### Indian English | Two-Host Conversational Format | ~4–5 Minutes

---

> **Production Notes:**
> - **Format:** Two-host conversational podcast (NotebookLM audio-ready)
> - **Tone:** Curious, warm, slightly geeky — real-talk Indian tech enthusiast style
> - **Language:** Indian English — natural, direct, occasionally desi-flavored
> - **Pacing:** Energetic on problem sections, slower and emphatic on the privacy and ML angle
> - **Target audience:** Indian tech users, Android enthusiasts, smart home folks, accessibility-focused households

---

## 🎬 SCENE 1 — THE HOOK (0:00–0:25)

**[Upbeat background music — think lo-fi bedroom studio meets tech podcast energy]**

**HOST 1 (ARJUN):**
Okay tell me — you are watching a movie. Full volume. Hero is about to say something important. And your mom walks in and starts talking.

**HOST 2 (MEERA):**
Oh yaar, every single time. And then you are like — *pause, lower, apologise, replay* — and by then the moment is completely gone.

**HOST 1 (ARJUN):**
Exactly. And what do you do? You grab the remote, or your phone, and manually turn it down. Every. Single. Time.

**HOST 2 (MEERA):**
What if your phone just... knew? What if it heard that someone was talking and just — automatically — ducked the volume?

**HOST 1 (ARJUN):**
That is literally what SoNex does. And we are going to tell you exactly how.

---

## 🎬 SCENE 2 — WHAT IS SONEX? (0:25–1:10)

**HOST 2 (MEERA):**
So SoNex is a privacy-first Android app that automatically adjusts your media volume based on what is happening in the room.

**HOST 1 (ARJUN):**
Someone talks? Volume ducks. Room gets noisy — like kitchen, traffic, AC sounds? Volume rises. Call comes in? Everything mutes immediately. Call ends, room is quiet? Volume comes back. Automatically.

**HOST 2 (MEERA):**
And it works across your phone speaker, your Bluetooth speaker, your Chromecast, and a paired Android TV — all at the same time. One app, one brain, all your devices.

**HOST 1 (ARJUN):**
Built by PatienceAI. Same team behind Barrister — the law firm platform — and CrackXam. They are genuinely building interesting things.

---

## 🎬 SCENE 3 — THE TECH (HOW IT WORKS) (1:10–2:10)

**HOST 2 (MEERA):**
Okay the part I find most interesting — it is not just volume rules. There is actual machine learning running on your phone.

**HOST 1 (ARJUN):**
Right. So SoNex uses two on-device models. Silero VAD — Voice Activity Detection — and YAMNet, which is Google's audio classification model. Every 30 milliseconds, it is listening to the room and classifying — is this speech? Is this background noise? Is this quiet?

**HOST 2 (MEERA):**
And 30 milliseconds is basically real-time, right? You speak one word and it has already reacted.

**HOST 1 (ARJUN):**
Exactly. And if somehow the models are not available — say you are on an older device — there is an energy-heuristic fallback. So it always works.

**HOST 2 (MEERA):**
Now here is the thing that actually impressed me. The learning part. SoNex has a server-side training loop. With your consent, it learns from your actual home — your overrides, your corrections — and pushes a personalised model back to your phone. Over the air. No app update needed.

**HOST 1 (ARJUN):**
So over time, SoNex learns your house. Your living room is louder than your bedroom. Your kitchen has the pressure cooker sound that should not trigger ducking. It figures this out.

**HOST 2 (MEERA):**
And the voice control — you can just say "SoNex, lower volume" in English or Hindi. On-device Vosk speech recognition. No cloud call for that command.

---

## 🎬 SCENE 4 — PRIVACY (THE BIG DEAL) (2:10–3:00)

**HOST 1 (ARJUN):**
Now I know what everyone is thinking. Arjun, Meera — this app is always listening to my room. That is creepy.

**HOST 2 (MEERA):**
And that is a completely fair concern. So let us be very clear about how the privacy works.

**HOST 1 (ARJUN):**
All audio processing — everything — happens on your phone. The models run locally. The raw audio never leaves your device. SoNex does not stream your conversations to any server.

**HOST 2 (MEERA):**
The only thing that optionally goes out is anonymised events — like "speech detected at this time, volume was ducked" — and only if you explicitly turn on data sharing. And every single purpose has its own toggle. All off by default.

**HOST 1 (ARJUN):**
It is built to be compliant with India's DPDP Act 2023 and GDPR. This is not an afterthought — it is a hard design constraint baked in from day one.

**HOST 2 (MEERA):**
So the short version — it listens to the room acoustics. It does not listen to your conversations.

---

## 🎬 SCENE 5 — SETUP & CALIBRATION (3:00–3:35)

**HOST 1 (ARJUN):**
Setup is surprisingly simple. You pair your phone and Android TV with a four-digit code over Wi-Fi. Local network only, no account needed for pairing.

**HOST 2 (MEERA):**
Then there is a three-step calibration wizard. You record your room's silence floor — so it knows what quiet sounds like. Then media-only baseline. Then media plus talking. It creates a named profile for that room.

**HOST 1 (ARJUN):**
Different profiles for different rooms — living room, bedroom, kitchen — each with their own calibration. After that, you are done. SoNex handles it from there.

---

## 🎬 SCENE 6 — WHO IS IT FOR? (3:35–4:00)

**HOST 2 (MEERA):**
I think this is genuinely useful for a lot of people. Joint families — very relatable in India. Home theatre setups. People who are hard of hearing and need that automatic boost in noisy rooms.

**HOST 1 (ARJUN):**
And honestly just anyone who is tired of reaching for the remote fifty times a day.

**HOST 2 (MEERA):**
The product page is at sonex.patienceai.in. It is new, it is in active development, and given everything they have built into it — on-device ML, OTA learning, multi-device support, privacy compliance — this is a seriously ambitious project.

---

## 🎬 SCENE 7 — CLOSE (4:00–4:20)

**HOST 1 (ARJUN):**
SoNex — room-aware, privacy-first, and honestly, one of the more genuinely clever Android products we have seen from an Indian team in a while.

**HOST 2 (MEERA):**
Check it out at sonex.patienceai.in. And if you want to see the full PatienceAI product lineup — Barrister, CrackXam, Nexus Exchange — head over to patienceai.in.

**HOST 1 (ARJUN):**
We will see you next time.

**[Music fades up and out]**

---

## ✂️ 30-Second Cut

**HOST 1:** Your phone could automatically lower the volume when someone talks — and raise it when the room gets loud. That is SoNex. On-device ML, no cloud audio, works across phone, Bluetooth, Android TV, and Chromecast. Learns your home over time. Privacy-first, DPDP compliant. **HOST 2:** From PatienceAI. Check it at sonex.patienceai.in.

---

## ✂️ 15-Second Pre-Roll

**HOST 1:** Tired of reaching for the remote every time someone talks? SoNex automatically ducks and raises your media volume — across all your devices — using on-device AI. No cloud audio. Ever. **HOST 2:** sonex.patienceai.in — PatienceAI.
